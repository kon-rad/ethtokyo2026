#!/bin/sh
# PID 1 for the Pi Zero seat key: the kernel runs this instead of systemd
# (cmdline.txt: init=/opt/zero-signer/zero-fastinit.sh), so the signer starts a few
# seconds after the kernel instead of after a full systemd boot.
#
# The root filesystem stays read-only (the kernel mounts it that way and nothing remounts
# it), so pulling the key out mid-boot can't corrupt the card.
#
# If the signer keeps failing (e.g. no cached key yet, which needs a writable disk), this
# hands over to a normal systemd boot, where zero-tx-signer.service runs it instead.
# To go back to systemd for good, delete the init=... argument from cmdline.txt on the Mac.
export PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/root PYTHONDONTWRITEBYTECODE=1
export ZERO_KEY_FILE=/var/lib/zero-signer/mnemonic ZERO_CHAIN_IDS=11155111

mount -t proc proc /proc 2>/dev/null
mount -t sysfs sysfs /sys 2>/dev/null
mount -t devtmpfs devtmpfs /dev 2>/dev/null  # usually already mounted by the kernel
# Without systemd nothing switches the CPU off the kernel's slow default governor
for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  echo performance > "$g" 2>/dev/null
done
# No udev either, so load the USB gadget drivers by hand: /dev/ttyGS0 appears after this
modprobe dwc2
modprobe g_serial

tries=0
while [ "$tries" -lt 3 ]; do
  /opt/zero-signer/venv/bin/python /opt/zero-signer/zero-tx-signer.py
  tries=$((tries + 1))
  sleep 2
done
exec /sbin/init
