# Residency Status Board — Pi Setup Guide

### Turn a Raspberry Pi 4 + 3.5" touchscreen into a live AI City residency display

---

## What you'll have

A wall-mounted display in the common room showing:

- Residency name, location and live status (Funding / Active / Failed / Closed)
- Seats-filled bar with the minimum marker
- Deadline countdown (big, readable from across the room)
- USDC held, staked and withdrawn
- Recent activity feed: staked beds and host withdrawals with receipt notes
- The contract address and last-refreshed timestamp

All read-only, no private keys on the device, no wallet needed.

---

## Parts

| Item | Notes |
|---|---|
| Raspberry Pi 4 | Any model, 2 GB+ RAM |
| 3.5" SPI touchscreen | 480x320, connected via the GPIO header |
| MicroSD card (16 GB+) | Raspberry Pi OS Lite or Desktop |
| Power supply | USB-C, 3A |
| Wi-Fi or Ethernet | Network access to the web app and the Ethereum RPC |

---

## Step 1: Flash the Pi

Download **Raspberry Pi OS** (Lite is enough; Desktop is fine too) and flash it:

```bash
# Find your SD card
diskutil list
# Unmount it (replace /dev/diskN with your card)
diskutil unmountDisk /dev/diskN
# Flash (replace path to .img and /dev/diskN)
sudo dd if=2024-11-19-raspios-bookworm-arm64-lite.img of=/dev/diskN bs=4M status=progress
```

Before ejecting, mount the boot partition and enable SSH + Wi-Fi:

```bash
# Mount the boot partition (it auto-mounts after dd)
touch /Volumes/boot/ssh
# Create wpa_supplicant.conf for Wi-Fi
cat > /Volumes/boot/wpa_supplicant.conf << 'EOF'
country=MY
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
network={
    ssid="YourWiFiName"
    psk="YourWiFiPassword"
}
EOF
```

Eject the card, put it in the Pi, power on. Find the Pi's IP from your router's DHCP list or via:

```bash
ping raspberrypi.local   # mDNS often works
```

SSH in:

```bash
ssh pi@raspberrypi.local   # password: raspberry
```

---

## Step 2: Configure the screen

The 3.5" SPI screen needs its driver loaded. Most use the `fbtft` or `waveshare` overlay.

```bash
# Edit config.txt on the boot partition
sudo nano /boot/firmware/config.txt
```

Add at the end (adjust for your screen — Waveshare 3.5" is common):

```
dtoverlay=waveshare35a
# or: dtoverlay=waveshare35b  (if 35a doesn't work)
# or: dtoverlay=adafruit35a  (for Adafruit branded screens)

# Rotate 180 degrees if mounted upside down:
dtoverlay=waveshare35a,rotate=270
# Or for the display_rotate:
# display_rotate=2
```

Reboot:

```bash
sudo reboot
```

After reboot, check the screen works:

```bash
# You should see a console login on the LCD
ls /dev/fb*
# Should show /dev/fb0 (the SPI screen) and possibly /dev/fb1 (HDMI)
```

---

## Step 3: Install Chromium and dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y chromium-browser xserver-xorg xinit x11-utils unclutter

# If running Pi OS Lite (no desktop), also install:
sudo apt install -y openbox
```

---

## Step 4: Get the AI City web app URL

You need a residency that's deployed onchain. The board page is at:

```
https://your-aicity-app.vercel.app/r/0xRESIDENCY_ADDRESS/board
```

For local development:

```
http://192.168.1.X:3100/r/0xRESIDENCY_ADDRESS/board
```

Replace `0xRESIDENCY_ADDRESS` with the deployed residency contract address.

**Test it first in a regular browser.** The board should fill the whole screen, show the residency name, seats bar, deadline countdown and USDC metrics, and update every 15 seconds.

---

## Step 5: Auto-start Chromium in kiosk mode

Create a script that starts X and Chromium fullscreen on the SPI screen:

```bash
cat > ~/start-board.sh << 'EOF'
#!/bin/bash
# Kill existing X sessions
killall xinit 2>/dev/null
killall chromium-browser 2>/dev/null
sleep 1

# Point at your residency board URL
URL="http://192.168.1.X:3100/r/0xRESIDENCY_ADDRESS/board"

# Start X on the SPI framebuffer, then Chromium in kiosk mode
xinit /usr/bin/chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-features=TranslateUI \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --noerrdialogs \
  --disable-notifications \
  --disable-popup-blocking \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --touch-events=disabled \
  --incognito \
  "$URL" \
  -- \
  :0 vt1 &
EOF

chmod +x ~/start-board.sh
```

Test it:

```bash
~/start-board.sh
```

The screen should show Chromium in fullscreen at the board page. Press **Alt+F4** to close.

---

## Step 6: Auto-start on boot

```bash
# Add to crontab (runs at reboot)
(crontab -l 2>/dev/null; echo "@reboot sleep 10 && /home/pi/start-board.sh") | crontab -
```

Or use a systemd service:

```bash
sudo tee /etc/systemd/system/board.service << 'EOF'
[Unit]
Description=AI City Residency Status Board
After=network.target

[Service]
User=pi
ExecStart=/home/pi/start-board.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable board.service
sudo systemctl start board.service
```

---

## Step 6b: Hide the cursor

Add `unclutter` to the startup script to hide the mouse cursor after 1 second of inactivity:

```bash
# Add this line before the xinit call in start-board.sh
unclutter -idle 1 &
```

---

## Step 7: Remote management

Keep the Pi accessible over SSH for updates:

```bash
# Check the board is running
ps aux | grep chromium

# Reload (e.g. after changing the URL)
pkill chromium-browser
~/start-board.sh

# Update the OS
sudo apt update && sudo apt upgrade -y

# Reboot cleanly
sudo reboot
```

---

## Changing the displayed residency

Edit `~/start-board.sh` and change the `URL` variable. Then:

```bash
pkill chromium-browser
~/start-board.sh
```

To make the board cycle through multiple residencies, you'd need a simple playlist script — but for a single-city demo, one URL is simpler and more reliable.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Screen stays black | SPI driver not loaded | Check `/boot/firmware/config.txt` has the overlay |
| Chromium starts on HDMI instead of SPI | X is using the wrong framebuffer | Add `--display=:0` to the xinit args, or set `FRAMEBUFFER=/dev/fb0` |
| Chromium is very slow | SPI screen has low bandwidth | Set `--disable-gpu` and `--disable-accelerated-2d-canvas` |
| Board doesn't update | Network or RPC issue | Check `curl` to the URL from the Pi. Check the RPC URL in the web app's config. |
| Touch doesn't work | Touch driver not loaded | Add `dtoverlay=waveshare35a,touch` or check the screen's specific overlay |
| Screen is upside down | Mount orientation | Add `rotate=270` or `rotate=90` to the overlay in config.txt |
| Page shows a white screen with errors | The residency address doesn't exist on that chain | Double-check the contract address and chain ID in the URL |

---

## Switching to a different residency

If you want to point the board at a different residency (e.g. after deploying a new one):

```bash
# Get the new residency address from the deploy output or the web app
# Then update the URL in the startup script
sed -i 's|0xOLD_ADDRESS|0xNEW_ADDRESS|g' ~/start-board.sh
pkill chromium-browser
~/start-board.sh
```

---

## Sources

- `Projects/ai-city/web/app/r/[address]/board/` — the board page source code
- `docs/hardware-integrations.md` — hardware project catalogue
- `docs/technical-architecture.md` — chain read functions used by the board