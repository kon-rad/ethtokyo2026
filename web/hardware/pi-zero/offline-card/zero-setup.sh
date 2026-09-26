#!/bin/bash
# First-boot setup for an offline Pi Zero seat key. cloud-init runs it once
# (user-data runcmd). It needs no network: everything is on the boot partition.
#
#   /boot/firmware/zero-setup/zero-setup.sh          this script
#   /boot/firmware/zero-setup/zero-tx-signer.py      the signer
#   /boot/firmware/zero-setup/zero-seat-key.service  its systemd unit
#   /boot/firmware/zero-setup/wheels/*.whl           eth-account + pyserial for this Python, ARMv6
#   /boot/firmware/zero-setup/expected-address       the address the key must derive
#   /boot/firmware/seat-key.txt                      the private key; moved off FAT and erased
#
# The result is written to /boot/firmware/zero-status.txt, readable from the Mac.

set -u
umask 077
BOOT=/boot/firmware
SRC=$BOOT/zero-setup
OPT=/opt/zero-signer
STATE=/var/lib/zero-signer
STATUS=$BOOT/zero-status.txt
fail() { echo "ERROR setup: $*" > "$STATUS"; exit 1; }

EXPECTED=$(tr -d '[:space:]' < "$SRC/expected-address")

# 1. Python packages. A wheel is a zip, so an offline install is an unzip.
mkdir -p "$OPT/lib"
for w in "$SRC"/wheels/*.whl; do
  python3 -m zipfile -e "$w" "$OPT/lib" || fail "unpack $(basename "$w")"
done
PYTHONPATH=$OPT/lib python3 -c "import eth_account, serial" 2> "$OPT/import-error.txt" \
  || fail "import: $(tail -n1 "$OPT/import-error.txt")"
install -m 0700 "$SRC/zero-tx-signer.py" "$OPT/zero-tx-signer.py"

# 2. The key: off the FAT partition into root-only storage
install -d -m 0700 "$STATE"
if [ -f "$BOOT/seat-key.txt" ]; then
  tr -d '[:space:]' < "$BOOT/seat-key.txt" > "$STATE/private-key"
  shred -u "$BOOT/seat-key.txt" 2>/dev/null || rm -f "$BOOT/seat-key.txt"
fi
[ -s "$STATE/private-key" ] || fail "no key: save the private key as seat-key.txt on the boot partition"

# The signer checks the key derives EXPECTED and writes OK/ERROR to the status file
ZERO_KEY_FILE=$STATE/private-key ZERO_EXPECTED_ADDRESS=$EXPECTED ZERO_STATUS_FILE=$STATUS \
  PYTHONPATH=$OPT/lib python3 "$OPT/zero-tx-signer.py" address >/dev/null || exit 1

# 3. USB serial gadget (dtoverlay=dwc2 is already in config.txt)
printf "dwc2\ng_serial\n" > /etc/modules-load.d/zero-signer.conf
chmod 0644 /etc/modules-load.d/zero-signer.conf

# 4. Signer service
sed "s/REPLACE_EXPECTED_ADDRESS/$EXPECTED/" "$SRC/zero-seat-key.service" > /etc/systemd/system/zero-seat-key.service
chmod 0644 /etc/systemd/system/zero-seat-key.service
systemctl daemon-reload
systemctl enable zero-seat-key.service

# 5. Speed up boot: disable services we don't need for door duty
echo "Trimming boot services..."
for svc in avahi-daemon.service bluetooth.service hciuart.service dhcpcd.service \
           wpa_supplicant.service networking.service systemd-networkd.service \
           systemd-resolved.service getty@tty1.service alsa-state.service \
           pulseaudio.service cron.service anacron.service triggerhappy.service \
           systemd-fsckd.service; do
  systemctl disable "$svc" 2>/dev/null || true
  systemctl mask "$svc" 2>/dev/null || true
done
# Shorter systemd timeout
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/99-fast-boot.conf << 'TIMEOUT'
[Manager]
DefaultTimeoutStartSec=10s
DefaultTimeoutStopSec=5s
TIMEOUT
# Pre-compile Python imports so the Zero doesn't compile .pyc on every boot
echo "Pre-compiling Python imports (this takes a moment)..."
python3 -c "
import py_compile, sys, os
sp = os.path.join('/opt/zero-signer', 'lib')
count = 0
for root, dirs, files in os.walk(sp):
    for fn in files:
        if fn.endswith('.py'):
            try:
                py_compile.compile(os.path.join(root, fn), doraise=True)
                count += 1
            except Exception:
                pass
print(f'Pre-compiled {count} .py files')
" 2>&1
# Disable filesystem checks (SD card never uncleanly unmounts — just loses power)
tune2fs -c 0 -i 0 /dev/mmcblk0p2 2>/dev/null || true

echo "OK setup done for $EXPECTED; rebooting into the signer" > "$STATUS"
