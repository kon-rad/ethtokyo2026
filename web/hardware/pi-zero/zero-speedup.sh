#!/bin/bash
# AI City Pi Zero seat key: make the Zero answer the door sooner after it's plugged in.
# Runs once on the Zero, as root, from cloud-init. zero-update-card.sh (run on the Mac)
# puts it on the boot partition and bumps the cloud-init instance id so it runs.
# No network is used. Log: /boot/firmware/zero-speedup.log
#
# The Zero cold-boots on every insertion, so everything between power-on and the signer
# answering PING is door delay. This:
#   1. installs the new signer, whose door path doesn't import eth_account, after checking
#      it derives the same address, and caches that key (the one step that needs eth_account)
#   2. starts the signer as soon as the root filesystem and /dev/ttyGS0 are up
#   3. masks services and timers a networkless door key never needs
#   4. turns cloud-init off via cmdline.txt (delete "cloud-init=disabled" there to re-enable)
#   5. boots straight into the signer: zero-fastinit.sh as PID 1, no systemd, no initramfs
set -uo pipefail
SRC=/boot/firmware/zero-signer
BOOT=/boot/firmware
USER_NAME=konradgnat
PY=/opt/zero-signer/venv/bin/python
echo "zero-speedup started, uptime $(cut -d' ' -f1 /proc/uptime)s"

# 1. New signer, checked before it replaces the old one: the key it derives from the
#    mnemonic (and caches) must give the same address as before
"$PY" -m compileall -q /opt/zero-signer/venv/lib || echo "WARN compileall failed"
install -m 755 "$SRC/zero-tx-signer.py" /opt/zero-signer/zero-tx-signer.py.new
before=$(tr -d '[:space:]' < "$BOOT/zero-address.txt")
after=$(runuser -u "$USER_NAME" -- env ZERO_KEY_FILE=/var/lib/zero-signer/mnemonic \
  "$PY" /opt/zero-signer/zero-tx-signer.py.new address | tail -n1)
if [ "$before" != "$after" ]; then
  rm -f /opt/zero-signer/zero-tx-signer.py.new
  echo "ERROR new signer derives $after, card says $before. Nothing changed." | tee "$BOOT/zero-speedup-done.txt"
  exit 1
fi
mv /opt/zero-signer/zero-tx-signer.py.new /opt/zero-signer/zero-tx-signer.py
echo "key cached for $after"

# 2. Service: no default dependencies, so it isn't queued behind basic.target
sed "s/REPLACE_USER/$USER_NAME/" "$SRC/zero-tx-signer.service" > /etc/systemd/system/zero-tx-signer.service
systemctl daemon-reload
systemctl enable zero-tx-signer

# 3. Units a door key with no network, screen or keyboard never needs.
#    Timers matter most: with no real clock every boot looks overdue, so apt and man-db
#    fire right when the signer is trying to start on the one core.
for u in apt-daily.timer apt-daily-upgrade.timer man-db.timer e2scrub_all.timer fstrim.timer \
         dpkg-db-backup.timer \
         NetworkManager.service NetworkManager-wait-online.service NetworkManager-dispatcher.service \
         ModemManager.service wpa_supplicant.service dhcpcd.service networking.service \
         systemd-networkd.service systemd-networkd-wait-online.service systemd-resolved.service \
         avahi-daemon.service avahi-daemon.socket bluetooth.service hciuart.service \
         triggerhappy.service triggerhappy.socket cron.service anacron.service \
         keyboard-setup.service console-setup.service getty@tty1.service \
         rpi-eeprom-update.service udisks2.service ssh.service sshswitch.service \
         rpi-display-backlight.service alsa-restore.service alsa-state.service; do
  if systemctl list-unit-files "$u" --no-legend 2>/dev/null | grep -q .; then
    systemctl disable "$u" >/dev/null 2>&1
    systemctl mask "$u" >/dev/null 2>&1 && echo "masked $u"
  fi
done

# 4. cloud-init runs four Python stages on every boot. Off by kernel argument, so the Mac
#    can turn it back on by editing cmdline.txt.
if ! grep -q "cloud-init=disabled" "$BOOT/cmdline.txt"; then
  sed -i '1 s/$/ cloud-init=disabled/' "$BOOT/cmdline.txt"
fi

# 5. Fast boot: the kernel starts zero-fastinit.sh as PID 1 (no systemd, read-only root),
#    and the firmware skips the initramfs, splash and camera/display probing.
#    Undo from the Mac: delete init=... from cmdline.txt and the block at the end of config.txt.
install -m 755 "$SRC/zero-fastinit.sh" /opt/zero-signer/zero-fastinit.sh
sed -i -E '1 s/(^| )init=[^ ]*//g; 1 s/$/ init=\/opt\/zero-signer\/zero-fastinit.sh/' "$BOOT/cmdline.txt"
if ! grep -q "# AI City seat key fast boot" "$BOOT/config.txt"; then
  sed -i -E 's/^(auto_initramfs|camera_auto_detect|display_auto_detect)=1/\1=0/' "$BOOT/config.txt"
  printf '\n[all]\n# AI City seat key fast boot\nauto_initramfs=0\ndisable_splash=1\nboot_delay=0\ncamera_auto_detect=0\ndisplay_auto_detect=0\n' >> "$BOOT/config.txt"
fi
echo "cmdline.txt: $(cat "$BOOT/cmdline.txt")"
sync
echo "OK zero-speedup done for $after, rebooting" | tee "$BOOT/zero-speedup-done.txt"
