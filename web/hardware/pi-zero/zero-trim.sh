#!/bin/bash
# zero-trim.sh — Run once on the Pi Zero to trim boot time for door duty
#
# The Pi Zero takes ~3 minutes from USB power-on to signing a door challenge.
# This script cuts that to ~60-90 seconds by:
#   1. Disabling systemd services not needed for the door (no network, no avahi,
#      no triggers for hardware that doesn't exist, no getty on HDMI).
#   2. Pre-compiling Python imports so the signer doesn't compile .pyc on first boot.
#   3. Setting a shorter systemd timeout for the serial gadget device.
#
# Run this over SSH while the Zero is still online (before disable-wifi).
#
#   ssh <user>@zero-signer.local 'sudo bash -s' < web/hardware/pi-zero/zero-trim.sh
#
# After it finishes, re-check boot time by power-cycling and timing how long
# until PONG arrives.

set -euo pipefail
echo "=== Zero boot trimmer ==="

# ── 1. Disable services we don't need ────────────────────────────
SERVICES_TO_DISABLE=(
  # No network
  avahi-daemon.service
  bluetooth.service
  hciuart.service
  dhcpcd.service
  wpa_supplicant.service
  networking.service
  systemd-networkd.service
  systemd-resolved.service
  # No HDMI display
  getty@tty1.service
  # No sound
  alsa-state.service
  pulseaudio.service
  # No cron/triggers
  cron.service
  anacron.service
  triggerhappy.service
  # No filesystem monitoring
  systemd-fsckd.service
)

for svc in "${SERVICES_TO_DISABLE[@]}"; do
  if systemctl is-enabled "$svc" &>/dev/null 2>&1; then
    echo "Disabling $svc"
    systemctl disable "$svc" 2>/dev/null || true
    systemctl mask "$svc" 2>/dev/null || true
  fi
done

# ── 2. Shorter systemd timeout ──────────────────────────────────
# Default DefaultTimeoutStartSec is 90s. Bring it down so the signer
# starts faster if its device dependency is slow.
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/99-fast-boot.conf << 'EOF'
[Manager]
DefaultTimeoutStartSec=10s
DefaultTimeoutStopSec=5s
EOF

# ── 3. Pre-compile the signer's Python imports ──────────────────
# On armv6, importing eth_account + all its C extensions takes 30-60s
# because Python compiles .pyc on first import. Pre-compile them.
echo "Pre-compiling Python imports..."
VENV=/opt/zero-signer/venv
if [ -d "$VENV" ]; then
  # The signer imports these; compile them to .pyc now
  "$VENV/bin/python" -c "
import py_compile, sys, os
# Walk the venv's site-packages and pre-compile everything
sp = os.path.join(os.path.dirname(sys.executable), '..', 'lib',
                  f'python{sys.version_info.major}.{sys.version_info.minor}',
                  'site-packages')
sp = os.path.normpath(sp)
count = 0
for root, dirs, files in os.walk(sp):
    for fn in files:
        if fn.endswith('.py'):
            full = os.path.join(root, fn)
            try:
                py_compile.compile(full, doraise=True)
                count += 1
            except py_compile.PyCompileError:
                pass  # syntax errors in vendored code — not our problem
print(f'Pre-compiled {count} .py files')
" 2>&1
fi

# Also pre-compile the signer script itself
if [ -f /opt/zero-signer/zero-tx-signer.py ]; then
  python3 -m py_compile /opt/zero-signer/zero-tx-signer.py 2>/dev/null || true
fi

# ── 4. Speed up USB gadget enumeration ─────────────────────────
# The g_serial module loads but the device node can take a moment.
# A shorter udev settle time helps.
echo 'udev_settle=100' >> /boot/firmware/cmdline.txt 2>/dev/null || true

# ── 5. Disable filesystem checks on boot (safe for an SD card that's never
#       uncleanly shut down — it just loses power when unplugged)
tune2fs -c 0 -i 0 /dev/mmcblk0p2 2>/dev/null || true

echo "=== Done. Reboot and test. ==="
echo "Expected improvement: ~60-90s off the 3-minute door-open time."