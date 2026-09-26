# Pi 4 + Arduino + Servo + Screen: Setup Guide
### Build the residency status board and door latch from the parts already on the desk

**Written:** 2026-09-27
**Goal:** A Raspberry Pi 4 that shows a residency's live status board on its 3.5" screen, reads the `Residency` contract, and drives an Arduino Uno that lights a 10-segment seat bar and moves an SG90 servo latch.
**Scope:** Pi 4, Arduino, servo and screen only. The Pi Zero seat key comes after this; see [`pi-zero-seat-key-guide.md`](pi-zero-seat-key-guide.md). This guide replaces the screen and service steps in that guide and in [`pi-status-board-setup.md`](pi-status-board-setup.md) where they differ, because it follows what was tested on the actual hardware on 2026-09-26.

---

## TL;DR — the five things that matter

1. **The screen covers GPIO pins 1–26, so the Arduino connects to the Pi over USB, not GPIO.** The Uno is the Pi's I/O board. The T-cobbler and ribbon can't be used while the screen is seated.
2. **The screen already works. Don't use the Waveshare overlay from the older guide.** The tested config is `dtoverlay=piscreen,drm,speed=16000000,rotate=90`. Set rotation in Screen Configuration, because `rotate=` is ignored with `drm`.
3. **The board page needs a residency in the app's database.** The live Sepolia instance has no cities yet, and sign-in doesn't work there without TLS. Create the city and residency with the app running on your Mac, and point the Pi at the Mac. **This is the step most likely to change the plan.**
4. **Power the servo from the Uno to start. Move it to the breadboard power module if anything browns out.** The Pi runs from the power bank, and the power bank's USB-C output rating is unknown. Check `vcgencmd get_throttled`.
5. **Without the Pi Zero, the door stays locked.** The orchestrator only opens the latch for a verified seat key. With Pi 4 + Arduino, the LED bar tracks seats live. To see the servo move, drive it by hand over serial (step 4.3).

---

## 0. Fast path: the screen shows residency status, nothing else

If you only want the 3.5" screen showing a live residency (seats, status, deadline, USDC, activity), you need no Arduino, no servo and no files copied to the Pi. The board is a web page. The Pi opens a URL in kiosk mode, and the page polls the chain through the app.

| # | Where | Do | Section |
|---|---|---|---|
| 1 | Pi | Enable SSH, check power, install `unclutter` | [2](#2-pi-4-get-in-over-ssh) |
| 2 | Pi | Confirm the screen config, set landscape | [3](#3-screen-confirm-the-config-and-set-rotation) |
| 3 | Mac | Run the app on the LAN, create a city and residency on Sepolia | [5.1](#51-get-a-residency-the-board-can-show) |
| 4 | Pi | `curl` the board URL, then install the kiosk autostart file | [5.1](#51-get-a-residency-the-board-can-show), [5.2](#52-kiosk-on-boot) |
| 5 | Pi | Reboot. The board comes up on its own | [5.2](#52-kiosk-on-boot) |

The LED bar, latch and orchestrator (sections 4 and 6) are the next layer. Add them after the screen works.

### Moving files from the Mac to the Pi

Only sections 4.3, 6 and 6b copy files. Everything happens over SSH, so both machines must be on the same Wi-Fi. Run these on the Mac, from `Projects/ai-city`:

| Method | Command | Use when |
|---|---|---|
| **`scp`** (one file) | `scp web/hardware/pi4/pi4-orchestrator.py konradgnat@secondBrain.local:~/` | Copying one script. The default in this guide |
| **`rsync`** (folder) | `rsync -av web/hardware/ konradgnat@secondBrain.local:~/aicity-hardware/` | You changed several scripts. Re-run it after each edit, and it copies only what changed |
| **`git clone`** (on the Pi) | `git clone https://github.com/kon-rad/ethtokyo2026.git ~/ai-city` | Only once the hardware scripts are pushed. As of 2026-09-27, `pi4-gpio-board.py` and the Pi Zero signer are uncommitted, so the clone won't have them |

If `secondBrain.local` doesn't resolve, get the Pi's IP by running `hostname -I` on the Pi, and use `konradgnat@<pi-ip>`. To avoid typing the password every time, run `ssh-copy-id konradgnat@secondBrain.local` once.

The Arduino sketch doesn't go to the Pi. You flash it from the Mac in the Arduino IDE (4.2), and the Uno keeps it.

---

## 1. Parts from the inventory

From [[cyberdeck-inventory]] (`Areas/argo/cyberdeck/cyberdeck-inventory.md`, 2026-09-26).

| Use | Item from the inventory | Why this one |
|---|---|---|
| Brain | **Raspberry Pi 4 Model B** | Runs the board in Chromium and the orchestrator |
| Screen | **3.5" RPi Display, 480×320, XPT2046 touch** (already seated on GPIO 1–26) | Tested and boots to desktop. The board page is laid out for 480×320 |
| SD card | **Raspberry Pi OS 2026-09-15, hostname `secondBrain`, user `konradgnat`** | Already configured with Wi-Fi |
| I/O board | **Arduino Uno** | Talks to the Pi over USB serial. Uses 5 V logic, so the LEDs and servo need no level shifting |
| Arduino work surface | **Half breadboard on the laser-cut wooden base plate** | Keeps the Uno and its wiring in one unit |
| Latch | **Micro servo SG90 (blue, horns in the bag)** | Known part, light load. Leave the black servo with the unread label as a spare |
| Seat meter | **10-segment LED bar graph** (move it off the full breadboard) | Shows staked seats 0–9 |
| Resistors | **Resistors on blue tape**: ×10, 220 Ω to 1 kΩ | One per LED segment. 220 Ω is red-red-brown. Check with the multimeter if unsure |
| Wires | **Jumper wire bundle** | Uno → breadboard |
| USB cable | **USB-A to USB-B** ("printer cable"). **Not in the inventory: find or buy one** | Pi 4 USB-A → the Uno's square silver USB-B socket (next to the barrel jack). Data and power. The GPIO UART isn't an option: the screen covers pins 8/10 and the Uno is 5 V logic |
| Servo power, if needed | **Breadboard power supply module (MB102)** | Separate 5 V for the servo if it browns out the Uno or Pi |
| Pi power | **Black power bank**, USB-C | Needs 5 V / 3 A. Rating unconfirmed |
| Input | **Jelly Comb keyboard over Bluetooth**, or SSH from the Mac | USB data is dead on this keyboard. The touch layer is resistive and weak, so use SSH for setup |
| Checking | **Innova 3320 multimeter** | Resistor values, LED polarity, 5 V rail |

Not used here: the Pi Zero (next guide), the I2C 16×2 LCD (an optional second display on the Uno), the joystick, the stepper, the HC-SR04, and the T-cobbler (blocked by the screen).

---

## 2. Pi 4: get in over SSH

SSH isn't enabled on the card yet. Pair the keyboard over Bluetooth, or use the stylus on the screen, and open a terminal on the Pi:

```bash
sudo systemctl enable --now ssh
```

From the Mac:

```bash
ssh konradgnat@secondBrain.local
```

Check that the power is good before adding the Arduino and servo:

```bash
vcgencmd get_throttled     # want: throttled=0x0
```

Anything other than `0x0` means under-voltage now or since boot. Fix the power bank or cable before going further. A servo will only make this worse.

Update and install the basics:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y python3-venv git curl unclutter
groups | grep -q dialout && echo "dialout OK"   # serial access to the Arduino
```

If `dialout OK` doesn't print, run `sudo usermod -aG dialout konradgnat` and log in again.

---

## 3. Screen: confirm the config and set rotation

The screen already works. Confirm the config matches what was tested:

```bash
grep -E 'spi|piscreen' /boot/firmware/config.txt
# expect:
# dtparam=spi=on
# dtoverlay=piscreen,drm,speed=16000000,rotate=90
```

The original is saved as `config.txt.bak` if you ever need to roll back.

**Rotation:** open **Preferences → Screen Configuration** on the Pi, pick the SPI display, and set orientation so the screen is landscape (480 wide × 320 tall) the way you'll mount it. The board page is designed for landscape.

**Touch** isn't needed. The board is read-only. Leave calibration for later.

---

## 4. Arduino: wire, flash, test

### 4.1 Wiring

Move the 10-segment LED bar from the full breadboard to the half breadboard next to the Uno.

**LED bar.** Most 10-segment bars have 20 pins: 10 anodes along one side and 10 cathodes along the other. They aren't common-cathode. To find the anode side, set the multimeter to diode mode and put the red probe on one pin and the black probe on the pin opposite. If a segment glows faintly, the red probe is on the anode.

| Segment | Uno pin → | Resistor | Cathode → |
|---|---|---|---|
| 1 | D2 | 220 Ω–1 kΩ | GND rail |
| 2 | D3 | 220 Ω–1 kΩ | GND rail |
| 3 | D4 | 220 Ω–1 kΩ | GND rail |
| 4 | D5 | 220 Ω–1 kΩ | GND rail |
| 5 | D6 | 220 Ω–1 kΩ | GND rail |
| 6 | D7 | 220 Ω–1 kΩ | GND rail |
| 7 | D8 | 220 Ω–1 kΩ | GND rail |
| 8 | D9 | 220 Ω–1 kΩ | GND rail |
| 9 | D10 | 220 Ω–1 kΩ | GND rail |
| 10 | D11 | 220 Ω–1 kΩ | GND rail |

Connect the breadboard GND rail to a Uno **GND** pin.

**SG90 servo:**

| Servo wire | Goes to |
|---|---|
| Orange / yellow (signal) | Uno **D12** |
| Red (+5 V) | Uno **5V** |
| Brown (GND) | Uno **GND** |

**If the servo jitters, the Uno resets, or `get_throttled` stops reading `0x0`,** move only the servo's power. Seat the MB102 module on the breadboard, set its jumper to 5 V, and power it from its own USB or barrel jack. Connect the servo's red wire to the MB102's +5 V rail and the brown wire to its GND rail. Then **link that GND rail to the Uno's GND**. Without a shared ground, the servo won't respond to the signal. The signal wire stays on D12.

```
Pi 4 USB-A ──USB-A→B──► Arduino Uno
                          D2…D11 ──[R]──► LED bar anodes; cathodes ─► GND rail
                          D12 ─────────► SG90 signal
                          5V  ─────────► SG90 red (or MB102 +5V instead)
                          GND ─────────► GND rail, SG90 brown, MB102 GND
```

### 4.2 Flash the sketch from the Mac

The sketch is [`web/hardware/arduino/seat-key-controller.ino`](../web/hardware/arduino/seat-key-controller.ino). It uses serial at 115200 baud, the LEDs on D2–D11, and the servo on D12. It locks at 0° and unlocks at 90°.

1. Plug the Uno into the Mac.
2. Open the file in the Arduino IDE. Set the board to **Arduino Uno** and choose the port (`/dev/cu.usbmodem…`).
3. Upload. `Servo.h` ships with the IDE.
4. In the Serial Monitor at 115200 baud, set the line ending to **No line ending** and send:

| Send | Expect |
|---|---|
| `R` | `OK:RESET`. LEDs off, servo at 0° |
| `5` | 5 segments lit |
| `O` | `OK:UNLOCKED`. Servo swings to 90° |
| `C` | `OK:LOCKED`. Servo back to 0° |
| `S` | `LEDS:5 DOOR:LOCKED` |

If the whole bar lights backwards, one segment is reversed or the bar is in upside down. Flip it. If the servo stalls or buzzes at 0°, move the horn one spline, or set `SERVO_LOCKED = 5`.

### 4.3 Move it to the Pi and test there

Plug the Uno into a Pi 4 USB-A port. Then on the Pi:

```bash
ls -l /dev/serial/by-id/          # expect usb-Arduino…-if00 -> ../../ttyACM0
python3 -m venv ~/aicity-venv
~/aicity-venv/bin/pip install pyserial pyserial-asyncio eth-account
~/aicity-venv/bin/python -m serial.tools.miniterm /dev/ttyACM0 115200
```

Type `R`, `5`, `O`, `C` as before. Each keypress is sent immediately. Quit with **Ctrl+]**. The Uno resets when the port opens, so wait about 2 seconds before typing.

This is also how you show the latch moving before the Pi Zero exists.

---

## 5. The board on the screen

### 5.1 Get a residency the board can show

`/r/[address]/board` returns 404 unless the residency is in the app's Postgres. As of 2026-09-27, the live Sepolia instance has no cities, and sign-in there needs a domain and TLS. So create one locally:

1. On the Mac, set up `web/.env.local` for Sepolia (see [`README.md`](../README.md): the Sepolia factory, mock USDC and deploy block from [`DEVLOG.md`](../DEVLOG.md), and `ALLOW_DEV_VERIFY=1` plus `NEXT_PUBLIC_ALLOW_DEV_VERIFY=1`). It has to be the dev server, because `/api/world/dev-verify` returns 404 in production builds.
2. Start it on the Mac's LAN address, not `localhost`:

```bash
MAC_IP=$(ipconfig getifaddr en0); echo $MAC_IP
cd web && pnpm dev --port 3100 --hostname $MAC_IP
```

   **Why `--hostname`:** Next 16's dev server blocks its dev assets for requests from any hostname except `localhost` and the one it was started with (`allowedDevOrigins` in `node_modules/next/dist/docs/`). With a plain `pnpm dev`, the Pi would get the page's HTML without the JavaScript, so the board would stop updating. Starting it on the LAN IP allows that hostname. Use `http://$MAC_IP:3100` in the Mac's browser too, because `localhost` won't answer. If macOS asks whether `node` may accept incoming connections, click **Allow**.
3. Sign in, create a city, propose a residency, approve it, and deploy it. Stake one or two test seats from a second wallet, so the board and the LED bar have something to show.
4. Note the residency address from `/r/<address>`. Open `http://$MAC_IP:3100/r/<address>/board` on the Mac first, to see what the Pi will show.
5. From the Pi, check that it can reach the board:

```bash
curl -sI http://<mac-lan-ip>:3100/r/<address>/board | head -1   # want 200
```

The Mac has to stay awake with the dev server running, or the board freezes on its last data. If the Mac's IP changes (a new Wi-Fi, or a DHCP lease that expires), update the URL in the kiosk file. Both problems go away once the droplet has a domain and TLS.

When the droplet gets a domain and TLS, swap the URL for the live one. The board is read-only, so it doesn't need sign-in on the Pi.

### 5.2 Kiosk on boot

The Pi boots to its desktop on the LCD, so start Chromium from the desktop's autostart. Don't use `xinit` as in the older guide.

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/aicity-board.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=AI City board
Exec=sh -c 'sleep 8; unclutter -idle 1 & chromium --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run --incognito --disable-pinch --overscroll-history-navigation=0 http://<mac-lan-ip>:3100/r/<address>/board'
EOF
sudo reboot
```

The `sleep 8` gives Wi-Fi time to come up. To change the residency, edit the URL in that file and reboot. Or SSH in and run `pkill chromium`, then log out and back in.

The SPI link is slow, so full-screen redraws lag. That's fine for the board: it polls every 15 to 60 seconds. If Chromium is sluggish, add `--disable-gpu`.

---

## 6. The orchestrator: chain → LED bar and latch

[`web/hardware/pi4/pi4-orchestrator.py`](../web/hardware/pi4/pi4-orchestrator.py) reads `seatCount()` and `status()` every 5 seconds with `cast`, and sends the seat count to the Uno. It sends `C` (lock) on every cycle when no seat key is present.

### 6.1 Install Foundry and copy the script

On the Pi:

```bash
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup
~/.foundry/bin/cast --version
```

From the Mac, in `Projects/ai-city`:

```bash
scp web/hardware/pi4/pi4-orchestrator.py konradgnat@secondBrain.local:~/
```

### 6.2 Run it by hand first

```bash
export PATH="$HOME/.foundry/bin:$PATH"
export RESIDENCY_ADDRESS=0x…                      # from step 5.1
export RPC_URL=https://ethereum-sepolia-rpc.publicnode.com   # or your own Sepolia RPC
~/aicity-venv/bin/python ~/pi4-orchestrator.py
```

Expect `[chain] Seats: N/10  Status: Open` every 5 seconds, and the LED bar showing N. `[zero] Not connected (waiting...)` is normal without the Pi Zero. Stake another seat from the Mac, and the bar goes up within one cycle.

### 6.3 Run it on boot

The repo's `seat-key.service` assumes user `pi`, system Python and mainnet. Install this version instead. It uses your user, the venv, Sepolia, and Foundry on the `PATH`. Without that `PATH`, `cast` isn't found under systemd.

```bash
sudo tee /etc/systemd/system/seat-key.service << 'EOF'
[Unit]
Description=AI City residency orchestrator (Arduino LED bar + latch)
After=network-online.target
Wants=network-online.target

[Service]
User=konradgnat
WorkingDirectory=/home/konradgnat
Environment=PATH=/home/konradgnat/.foundry/bin:/usr/local/bin:/usr/bin:/bin
Environment=RESIDENCY_ADDRESS=0xYourResidencyAddress
Environment=RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/konradgnat/aicity-venv/bin/python /home/konradgnat/pi4-orchestrator.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now seat-key.service
journalctl -u seat-key -f
```

Only one program can hold `/dev/ttyACM0`. Stop the service (`sudo systemctl stop seat-key`) before using `miniterm` from step 4.3.

---

## 6b. No USB-B cable: skip the Arduino, drive from GPIO

If there's no USB-A to USB-B cable, wire the I2C LCD and servo to the Pi's free pins and use [`web/hardware/pi4/pi4-gpio-board.py`](../web/hardware/pi4/pi4-gpio-board.py) instead of the orchestrator. The Pi's 5 V pins are under the screen, so the servo gets 5 V from the breadboard power module (fed from a spare USB-A port on the power bank over a USB-A to USB-A cable, or a 9 V battery into its DC jack).

### Which display — I2C LCD, not an LED bar

This path uses a **16x2 I2C LCD** (QAPASS HW-061 with PCF8574 backpack) instead of a 10-segment LED bar. It's 4 wires vs 10, shows "Seats: 5" as readable text with a progress bar on row 2, and leaves GPIO free for other things. The code auto-probes the I2C address, so no `i2cdetect` guesswork.

### Wiring

Pins 39/40 are at the USB-port end of the Pi header. Odd-numbered pins are on the inner row, even-numbered on the outer edge. The I2C pins (3/5) are at the other end, nearest the SD card — still accessible since the screen covers only 1–26.

| From | To |
|---|---|
| Pi pin 3 (GPIO2, SDA) | LCD backpack SDA |
| Pi pin 5 (GPIO3, SCL) | LCD backpack SCL |
| Pi pin 6 (GND) | LCD backpack GND |
| Pi pin 1 (3.3 V) | LCD backpack VCC. **Not 5 V** — the backpack has its own regulator |
| Pi pin 32 (GPIO12) | Servo orange (signal) |
| Power module + rail (5 V) | Servo red. **Never to a Pi pin** |
| Power module − rail | Servo brown, and Pi pin 34 (shared ground) |

**Check before powering on:** nothing from the power module's + rail goes to the Pi. Ground is shared, power is separate.

### Install the I2C LCD library

On the Pi:

```bash
sudo apt install -y python3-smbus i2c-tools
sudo pip3 install RPLCD
# Enable I2C on the Pi if not already:
sudo raspi-config nonint do_i2c 0
# Verify the LCD appears:
sudo i2cdetect -y 1
```

You should see `0x27` or `0x3f` in the output. The program auto-detects it, so either works.

### Test

```bash
scp web/hardware/pi4/pi4-gpio-board.py konradgnat@secondBrain.local:~/
python3 ~/pi4-gpio-board.py test
```

The LCD shows "TEST: bar sweep", counts 0-8, then "TEST: latch open", swings the servo to 90°, closes it, and shows "All good!".

### Run (live chain)

```bash
RESIDENCY_ADDRESS=0x... RPC_URL=https://ethereum-sepolia-rpc.publicnode.com python3 ~/pi4-gpio-board.py run
```

The LCD shows "Seats: N/8" on row 1 with a progress bar on row 2, plus the status word on the right. Needs Foundry's `cast` on the Pi (step 6.1).

### Boot service

Same unit file as 6.3, but with `ExecStart=/usr/bin/python3 /home/konradgnat/pi4-gpio-board.py run` and the I2C libraries already installed.

---

## 7. Finished state

| Check | Pass when |
|---|---|
| Power | `vcgencmd get_throttled` → `0x0` with the servo moving |
| Screen | Board fills the 3.5" display in landscape after a cold boot, with no cursor |
| Arduino | `/dev/serial/by-id/usb-Arduino…` present; `miniterm` `S` answers |
| Orchestrator | `journalctl -u seat-key` shows seat count and status every 5 s |
| LCD (Arduino path) | Matches `seatCount()` (capped at 9) within 5 s of a stake |
| LCD (GPIO path) | Shows "Seats: N/8" with a progress bar, updating every 5 s |
| Latch | Locked at rest; opens on a manual `O` |

---

## 8. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| LCD is blank | I2C address isn't 0x27 | Run `sudo i2cdetect -y 1`. Edit `I2C_ADDR` in the script or let auto-detect find it (it also tries 0x3f) |
| LCD shows garbled characters | Wrong I2C address or 5 V on VCC | Check wiring. The backpack runs on 3.3 V |
| LCD flickers or dims | Shared ground missing or loose | Ensure the LCD's GND and Pi's GND (pin 6) are connected |
| `ModuleNotFoundError: RPLCD` | Library not installed | `sudo pip3 install RPLCD` |
| `No I2C LCD found` | I2C disabled or wrong wiring | `sudo raspi-config nonint do_i2c 0` then `sudo i2cdetect -y 1` to confirm |
| `[serial] /dev/ttyACM0: … Permission denied` | User not in `dialout` | `sudo usermod -aG dialout konradgnat`, reboot |
| `[serial] … Device or resource busy` | `miniterm` or the service already has the port | Close one of them |
| `ModuleNotFoundError: serial_asyncio` | Script run with system Python | Use `~/aicity-venv/bin/python` |
| `[chain] Read failed: … cast: not found` | Foundry not on `PATH` | The `Environment=PATH=…` line in the unit |
| `[chain] Read failed` with an RPC error | Wrong chain or a rate-limited RPC | Check the address is on Sepolia. Try another Sepolia RPC |
| Board shows 404 | Residency not in that app's database | Step 5.1. Use the instance where you created it |
| Pi reboots or the screen flickers when the servo moves | Brown-out on the shared 5 V supply | Move servo power to the MB102 with a shared ground |
| Screen shows desktop, not the board | Autostart file path or URL wrong | `cat ~/.config/autostart/aicity-board.desktop`. Run the `Exec` line by hand in a terminal on the Pi |

---

## 9. Next: the Pi Zero seat key

Follow [`pi-zero-seat-key-guide.md`](pi-zero-seat-key-guide.md) sections 1 and 4 once this works. Two fixes to make in the scripts first:

- **Zero's port name.** On the Zero, the USB gadget serial is `/dev/ttyGS0`. `zero-signer.py` opens `/dev/ttyAMA0`, the GPIO UART, so it should open `/dev/ttyGS0`. On the Pi 4, the Zero appears as another `/dev/ttyACM*`, next to the Uno, not as `ttyGS0`. So `pi4-orchestrator.py` should find both boards via `/dev/serial/by-id/` rather than hard-coding `ttyACM0` and `ttyGS0`.
- **The Pi 4 has 4 USB-A ports.** Uno in one, the Zero's DATA port in another. The Zero still needs its own power on its PWR port.

---

## What's confirmed vs. inferred

| Confirmed | Inferred / not yet tested |
|---|---|
| Pi 4 + 3.5" screen boots to desktop with `piscreen,drm` (2026-09-26) | Power bank delivers 5 V / 3 A under servo load |
| The screen occupies GPIO 1–26 | Whether the resistors on tape include 220 Ω values |
| Sketch pinout (D2–D11, D12, 115200 baud) and orchestrator commands, from the repo files | LED bar polarity and pinout: test with the meter |
| `/r/[address]/board` 404s when the residency isn't in the database (`getResidency` in `page.tsx`) | Chromium frame rate on the SPI display |
| Live Sepolia instance had no cities on 2026-09-27 (`/api/cities` returned `[]`) | That `publicnode` Sepolia RPC is reliable for a 5 s poll |

**Open questions:**
- Pi 4 RAM size (it affects how comfortably Chromium runs next to the orchestrator).
- Whether the 3.5" screen physically blocks pins 3 and 5 (the I2C pins) — if so, use software I2C on GPIO0/GPIO1 (pins 27/28).

Related: [`hardware-integrations.md`](hardware-integrations.md) · [`pi-status-board-setup.md`](pi-status-board-setup.md) · [`pi-zero-seat-key-guide.md`](pi-zero-seat-key-guide.md)
