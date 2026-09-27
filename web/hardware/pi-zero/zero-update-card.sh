#!/bin/bash
# Run on the Mac with the Pi Zero seat key's SD card in the reader. Stages zero-speedup.sh
# and the new signer on the boot partition and makes cloud-init run it once on the next boot.
#
#   web/hardware/pi-zero/zero-update-card.sh [/Volumes/bootfs]
#
# Then eject, put the card back in the Zero, and plug the Zero into the Pi 4 (or any USB
# power) for about 5 minutes: it installs, reboots, and is ready. Put the card back in the Mac
# to check: zero-speedup-done.txt should say OK, and zero-speedup.log has the details.
set -euo pipefail
VOL="${1:-/Volumes/bootfs}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -f "$VOL/cmdline.txt" ] || { echo "No cmdline.txt in $VOL: is the Zero's card mounted?"; exit 1; }
[ -f "$VOL/zero-address.txt" ] && [ -d "$VOL/zero-signer" ] \
  || { echo "$VOL isn't the Zero signer card (no zero-address.txt / zero-signer/)"; exit 1; }
grep -q "ds=nocloud" "$VOL/cmdline.txt" || { echo "cmdline.txt has no ds=nocloud; stopping"; exit 1; }

cp "$HERE/zero-tx-signer.py" "$HERE/zero-tx-signer.service" "$HERE/zero-speedup.sh" \
   "$HERE/zero-fastinit.sh" "$VOL/zero-signer/"
stamp=$(date +%Y%m%d-%H%M%S)
cp "$VOL/user-data" "$VOL/user-data.bak-$stamp"
cp "$VOL/cmdline.txt" "$VOL/cmdline.txt.bak-$stamp"
cp "$VOL/config.txt" "$VOL/config.txt.bak-$stamp"

# runcmd -> zero-speedup.sh (the rest of user-data, including the reboot, stays as it is)
python3 - "$VOL/user-data" <<'EOF'
import re, sys
p = sys.argv[1]
s = open(p).read()
new = ("runcmd:\n- [bash, -c, 'bash /boot/firmware/zero-signer/zero-speedup.sh"
       " > /boot/firmware/zero-speedup.log 2>&1']\n")
s, n = re.subn(r"^runcmd:\n(?:- .*\n)+", new, s, flags=re.M)
if n != 1:
    sys.exit("couldn't find the runcmd block in user-data")
open(p, "w").write(s)
EOF

# New instance id so cloud-init treats the next boot as a first boot; make sure it's enabled
python3 - "$VOL/cmdline.txt" "$stamp" <<'EOF'
import re, sys
p, stamp = sys.argv[1], sys.argv[2]
s = open(p).read().strip()
s = s.replace(" cloud-init=disabled", "")
s = re.sub(r"(^| )init=/opt/zero-signer/zero-fastinit\.sh", "", s)
s, n = re.subn(r"(ds=nocloud;i=)[^\s;]+", r"\g<1>aicity-zero-speedup-" + stamp, s)
if n != 1:
    sys.exit("couldn't find ds=nocloud;i=... in cmdline.txt")
open(p, "w").write(s + "\n")
EOF
if [ -f "$VOL/meta-data" ]; then
  sed -i '' -E "s/^instance-id:.*/instance-id: aicity-zero-speedup-$stamp/" "$VOL/meta-data"
fi
rm -f "$VOL/zero-speedup-done.txt" "$VOL/zero-speedup.log"
sync
echo "Staged. cmdline.txt now:"
cat "$VOL/cmdline.txt"
echo "Eject the card, boot the Zero once for ~5 minutes, then check zero-speedup-done.txt."
