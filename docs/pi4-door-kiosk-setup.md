# Pi 4 Door + Board Kiosk: Setup
### The status board on the 3.5" screen, a Pi Zero wallet as the seat key, and the SG90 latch on GPIO 12, with no keyboard on the Pi

**Written:** 2026-09-27
**Replaces, for this wiring:** the Arduino path in [pi4-arduino-servo-screen-setup.md](pi4-arduino-servo-screen-setup.md) and the untracked `pi4-door-orc.py` / `zero-door-program*.py` drafts, which use the wrong serial ports.

---

## How it works

1. The Pi 4 boots straight into Chromium kiosk on the 3.5" screen, showing the URL in `board-url.txt` (`start-board.sh`, labwc autostart).
2. `aicity-door.service` runs `web/hardware/pi4/pi4-door.py` and waits for a USB serial device.
3. You plug the Pi Zero's **USB data port** (the middle one, not PWR) into the Pi 4. The Zero powers up from the Pi 4 and starts `zero-tx-signer.py`.
4. The Pi 4 sends `DOOR:<residency>:<random 32 bytes>`. The Zero signs a fixed EIP-191 message with its wallet key and returns `DOOR_SIG:<sig>`.
5. The Pi 4 recovers the address and checks `DOOR_RULE`. If it passes, the latch opens for 30 s and locks again. The latch opens once per insertion.

The key that stakes (via `cold-sign.py` from the Mac) is the same key that opens the door.

## Everything is configured from the SD card

| File on the boot partition | What it does |
|---|---|
| `board-url.txt` | Kiosk URL. The door also reads the residency address from it. |
| `door.env` | `DOOR_RULE`, `RESIDENCY_ADDRESS`, `RPC_URL`, open time, latch angles. |
| `config.txt` | Screen (`piscreen,drm,rotate=0`, landscape) and `dtoverlay=pwm,pin=12,func=4` for the servo. |
| `user-data` + `meta-data` | cloud-init: installs the kiosk and the door service on first boot, then reboots. Bump `instance-id` in `meta-data` and `cmdline.txt` to make it run again. |
| `aicity/` | Copies of `pi4-door.py` and `aicity-door.service`, installed from here by cloud-init. |

## Door rules

| `DOOR_RULE` | Opens when | Needs |
|---|---|---|
| `pair` (default) | The first key plugged in is enrolled; after that only that address opens. | Nothing on chain. Use it for the bench test. |
| `staked` | `getMember(addr).staked` on the residency. | The residency deployed on Sepolia and the Zero's address staked. |
| `active` | Staked, `status()` is Active, and today is between `startTime` and `endTime`. | As above, plus the deadline passed with `minSeats` met. |

To re-pair, delete `/var/lib/aicity-door/paired-address` on the Pi.

## Wiring

| From | To |
|---|---|
| Servo orange (signal) | Pi pin 32 (GPIO 12) |
| Servo red | MB102 rail set to 5V |
| Servo brown | MB102 − rail |
| MB102 − rail | Pi pin 34 (GND) |
| Pi Zero USB data port | any Pi 4 USB port |

## Checks over SSH (`ssh konradgnat@secondBrain.local`)

```bash
journalctl -u aicity-door -f                     # door log: key on, OPEN / DENIED, locked
sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py test   # latch sweep
ls /dev/serial/by-id/                            # the Zero shows as *Gadget_Serial*
```

## Test 6: the servo opens and closes, over SSH

**Goal:** prove the SG90 on the breadboard follows `pi4-door.py close` / `open` on hardware PWM, before any Pi Zero or chain rule is involved. No key, no residency, no screen needed.
**Setup:** servo wired as in [Wiring](#wiring), MB102 switched on at 5V, Pi 4 booted with this SD card. Tape a paper flag to the horn so the angle is easy to read.

```bash
ssh konradgnat@secondBrain.local        # or by IP: arp -a | grep secondbrain
DOOR="/opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py"

# 6.1 PWM is set up
grep -n 'dtoverlay=pwm' /boot/firmware/config.txt   # dtoverlay=pwm,pin=12,func=4
ls /sys/class/pwm/                                  # pwmchip0
pinctrl get 12                                      # GPIO12 in alt mode, PWM0_0

# 6.2 The door service only moves the latch when a Zero is plugged in.
#     Leave it running with no key attached, or stop it (needs your sudo password):
journalctl -u aicity-door -n 1 --no-pager           # "door up: rule=pair ..."
# sudo systemctl stop aicity-door

# 6.3 Close, open, close — one command at a time, watch the horn
$DOOR close        # LOCKED_ANGLE (0°)
$DOOR open         # UNLOCKED_ANGLE (90°)
$DOOR close        # back to 0°

# 6.4 The built-in sweep
$DOOR test         # logs "latch -> 0.0", "-> 90.0", "-> 0.0"

# 6.5 Ten cycles in a row
for i in $(seq 1 10); do $DOOR open; sleep 1; $DOOR close; sleep 1; done

# 6.6 Power held up
vcgencmd get_throttled                              # throttled=0x0
dmesg | grep -i voltage | tail -3                   # nothing new

# 6.7 Service still up (start it again if you stopped it in 6.2)
systemctl is-active aicity-door                     # active
```

| # | Check | Pass |
|---|---|---|
| 6.1 | PWM overlay | `pwmchip0` exists and GPIO 12 reads as PWM0, not input |
| 6.2 | Service idle | Log ends at `door up`, no Zero plugged in (or service stopped) |
| 6.3 | `close` / `open` / `close` | The horn turns about 90° each way and stops. The latch is shut after `close` and clear after `open` |
| 6.4 | `test` | Three log lines, three moves, ends locked |
| 6.5 | Ten cycles | 20 moves, none skipped, the horn ends at the same place it started |
| 6.6 | Power | `throttled=0x0`; the Pi didn't reboot or drop SSH |
| 6.7 | Service back | `active`, and `journalctl -u aicity-door -n 5` shows it waiting for a key |
| — | Between moves | The servo goes quiet. `set_latch()` disables PWM 0.6 s after each move, so constant buzzing means it's still being driven |

**If it fails:**

| Symptom | Likely cause |
|---|---|
| `No such file or directory: /sys/class/pwm/pwmchip0` | Overlay missing or the Pi hasn't rebooted since `config.txt` changed |
| `Permission denied` on `export` or `duty_cycle` | User not in the `gpio` group. Add `sudo` in front of `$DOOR`, or `sudo usermod -aG gpio $USER` and log in again |
| Commands run, servo doesn't move | Servo ground not tied to Pi pin 34, MB102 off, or signal on the wrong pin (pin 32 is GPIO 12) |
| Moves the wrong way (open is shut) | Swap `LOCKED_ANGLE` and `UNLOCKED_ANGLE` in `door.env` |
| Moves, but not far enough to clear the latch | Widen the angles in `door.env` (e.g. `UNLOCKED_ANGLE=120`), or refit the horn one notch over |
| Pi reboots or SSH drops on a move | Servo is on the Pi's 5V pin instead of the MB102 rail |

**First run, 2026-09-27 (over SSH from the Mac, by IP; `secondBrain.local` didn't resolve):** 6.1 pass (overlay loaded, GPIO 12 = PWM0_0). 6.2: service left running and idle. 6.3 pass: `duty_cycle` 500000 → 1500000 → 500000. 6.4 pass: three log lines. 6.5 pass: 10 cycles, 0 command failures. 6.6 pass: `throttled=0x0`, no undervoltage in `dmesg`, no reboot during the moves. No sudo needed: `konradgnat` is in `gpio` and `pwm0` is group-writable. Seeing the horn move was left to Konrad at the desk.

`$DOOR` only works inside the SSH session where it was set. The `open`/`close` commands read the angles from the environment, not `door.env`. To test angles you've just changed in `door.env`, prefix them: `UNLOCKED_ANGLE=120 $DOOR open`. `cat /sys/class/pwm/pwmchip0/pwm0/duty_cycle` after a move shows the pulse sent: 500000 ns = 0°, 1500000 = 90°.

## Known gaps

- The board's residency `0xcafac3dd…052c` exists only on local anvil, not Sepolia, so `staked` and `active` fail with "no contract". A real Sepolia residency is needed for the chain rules.
- Door events only show in the journal, not on the screen.
- The Zero has no confirm button, so it signs any well-formed door challenge. The message format can't be reused as a transaction or a SIWE login.

## Door status indicator (board feedback)

The Pi 4's door script now POSTs its current state to `POST /api/residencies/[...]/door/status` as it works through a key insertion:

| Status | Meaning | Board shows |
|---|---|---|
| `checking` | Zero detected, waiting for PONG / verifying challenge | Amber pulsing dot + "Checking key..." |
| `opening` | Key verified, latch moving | Green pulsing dot + "Door opening..." |
| `open` | Latch is unlocked | Green dot + "Door open" |
| `denied` | Key rejected (wrong wallet, wrong rule) | Red dot + "Denied: reason" |
| `locked` | Door shut again | Nothing (status hidden) |

The board polls this every 2 seconds via `useDoorStatus()`. It requires `DOOR_API_KEY` in both `door.env` (on the Pi 4 boot partition) and `.env.local` (on the server) as a shared secret. Without it, the board just shows "In the house" with no door indicator — no crash, no error.

### How the Zero boot time was cut from ~3 minutes to ~60-90 seconds

The delay came from two sources:

1. **Raspberry Pi OS boot** (30-60s): the full OS boots with services for networking, bluetooth, sound, HDMI getty, and triggerhappy — none of which the offline door Zero needs. The fix (`zero-trim.sh` or now part of `offline-card/zero-setup.sh`) disables and masks these services.

2. **Python import time** (30-60s): `eth_account` and its C-extension dependencies (`pydantic-core`, `ckzg`, `bitarray`, `cytoolz`, `pycryptodome`) are big packages. On a single-core ARMv6, importing and compiling `.pyc` from scratch takes ~30-60 seconds. The fix pre-compiles all `.py` files in the venv's `site-packages` to `.pyc` on first setup, so imports are fast on every subsequent boot.

If your Zero SD card was flashed before this change, run the trim script separately:

```bash
# From the Mac, while the Zero is still online:
ssh <user>@zero-signer.local 'sudo bash -s' < web/hardware/pi-zero/zero-trim.sh
```
