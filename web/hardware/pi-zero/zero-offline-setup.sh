#!/bin/bash
# AI City Pi Zero signer: offline first-boot install, run once by cloud-init.
# Everything comes from this folder on the boot partition. No network is used.
set -euxo pipefail
SRC=/boot/firmware/zero-signer
USER_NAME=konradgnat

python3 -m venv --without-pip /opt/zero-signer/venv
PIP_WHL=$(ls "$SRC"/wheels/pip-*.whl)
/opt/zero-signer/venv/bin/python "$PIP_WHL/pip" install --no-index --find-links "$SRC/wheels" \
  eth-account eth-abi eth-utils pyserial
install -m 755 "$SRC/zero-tx-signer.py" /opt/zero-signer/zero-tx-signer.py
sed "s/REPLACE_USER/$USER_NAME/" "$SRC/zero-tx-signer.service" > /etc/systemd/system/zero-tx-signer.service

# USB serial gadget: the Zero's USB port becomes /dev/ttyGS0 (config.txt has dtoverlay=dwc2)
printf "dwc2\ng_serial\n" > /etc/modules-load.d/zero-signer.conf
usermod -aG dialout "$USER_NAME"

# Create the key now (offline) and publish only the address to the boot partition
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" /var/lib/zero-signer
runuser -u "$USER_NAME" -- env ZERO_KEY_FILE=/var/lib/zero-signer/mnemonic \
  /opt/zero-signer/venv/bin/python /opt/zero-signer/zero-tx-signer.py address \
  | tail -n1 > /boot/firmware/zero-address.txt

systemctl daemon-reload
systemctl enable zero-tx-signer
systemctl disable ssh 2>/dev/null || true
date > /boot/firmware/zero-setup-done.txt
