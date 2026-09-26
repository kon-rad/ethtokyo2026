# Pi Zero Offline Seat Key: Implementation Guide
### Set up the Pi 4, Arduino, Servo Latch, and Pi Zero for the pop-up city hardware demo

This guide walks through every step to make a physical door that opens only for a staked member of an active pop-up city residency. The Pi Zero holds the seat key offline. The Pi 4 reads the contract. The Arduino drives the LED bar and servo latch.

---

## Architecture overview

```
  Residency contract (Ethereum, one per residency)
    ▲  viem reads via cast (every 5s)
    │
  Pi 4 Model B
    ├── USB serial (/dev/ttyACM0) ──► Arduino Uno
    │                                     ├── 10-segment LED bar (D2-D11)
    │                                     └── SG90 servo latch (D12)
    │
    └── USB serial (/dev/ttyGS0)  ──► Pi Zero (USB gadget mode, air-gapped)
                                          └── signs "challenge + residencyAddress + ACCESS"
```

**No Wi-Fi on the Zero.** The Pi Zero has never touched the internet. It signs messages over a direct USB serial cable.

---

## Table of Contents

1. [Pi Zero setup](#1-pi-zero-setup)
2. [Arduino wiring and sketch](#2-arduino-wiring-and-sketch)
3. [Pi 4 orchestrator](#3-pi-4-orchestrator)
4. [Connection test](#4-connection-test)
5. [Demo script](#5-demo-script)
6. [Troubleshooting](#6-troubleshooting)
7. [Files in this repo](#7-files-in-this-repo)

---

## 1. Pi Zero setup

### 1.1 Flash the OS

1. Download Raspberry Pi OS Lite (64-bit) — no desktop needed.
2. Flash it to the Zero's microSD with Raspberry Pi Imager.
3. Before ejecting the SD card from your Mac, edit two files on the `boot` partition:

**Edit `config.txt`** — add this line at the end:
```
dtoverlay=dwc2
```

**Edit `cmdline.txt`** — this is a single line. Find `rootwait` and add after it:
```
modules-load=dwc2,g_serial
```

The result should look like (yours will differ before `rootwait`):
```
console=serial0,115200 console=tty1 root=PARTUUID=xxx-xx rootfstype=ext4 fsck.repair=yes rootwait modules-load=dwc2,g_serial quiet
```

**Keep it one line.** No line breaks.

### 1.2 Enable SSH (optional but useful for debugging)

Create an empty file called `ssh` (no extension) on the boot partition:
```bash
touch /Volumes/boot/ssh
```

### 1.3 Generate the seat key (on your Mac)

```bash
pip3 install eth-account
python3 -c "
from eth_account import Account
Account.enable_unaudited_hdwallet_features()
acct = Account.create()
print(f'Mnemonic: {acct.mnemonic}')
print(f'Address:  {acct.address}')
print(f'Key:      {acct.key.hex()}')
"
```

Save the **mnemonic** to `/boot/seat.seed` on the Zero's SD card:
```bash
python3 -c "
from eth_account import Account
Account.enable_unaudited_hdwallet_features()
print(Account.create().mnemonic)
" > /Volumes/boot/seat.seed
```

**Record the address** — you'll register it in the contract later.

### 1.4 Install dependencies on the Zero

Boot the Zero (power only, no data cable yet). SSH in or use a monitor+keyboard:

```bash
sudo apt update
sudo apt install -y python3-pip python3-serial
pip3 install eth-account
```

### 1.5 Copy the signing script

Create the script at `/home/pi/zero-signer.py` on the Zero:

<details>
<summary>Click to expand: /home/pi/zero-signer.py</summary>

```python
#!/usr/bin/env python3
"""
Pi Zero Offline Seat Key Signer
Runs over USB serial gadget mode. No Wi-Fi, no network.
Reads seed from /boot/seat.seed.
Only signs: challenge + residencyAddress + "ACCESS"
"""

import os, sys, time, json
from eth_account import Account
from eth_account.messages import encode_defunct

SEED_FILE = "/boot/seat.seed"
RESIDENCY_ADDRESS = "0x0000000000000000000000000000000000000000"  # REPLACE ME
SERIAL_PORT = "/dev/ttyAMA0"
BAUD = 115200

def load_key():
    if not os.path.exists(SEED_FILE):
        print(f"ERROR: no seed file at {SEED_FILE}", flush=True)
        sys.exit(1)
    with open(SEED_FILE) as f:
        seed = f.read().strip()
    Account.enable_unaudited_hdwallet_features()
    return Account.from_mnemonic(seed)

def sign_challenge(key, challenge_hex):
    message = challenge_hex + RESIDENCY_ADDRESS.lower() + "ACCESS"
    signed = key.sign_message(encode_defunct(text=message))
    return signed.signature.hex()

def main():
    key = load_key()
    addr = key.address
    print(f"BOOT:{addr}", flush=True)

    # Wait for serial device to appear
    import serial
    while not os.path.exists(SERIAL_PORT):
        time.sleep(1)

    ser = serial.Serial(SERIAL_PORT, BAUD, timeout=30)
    ser.write(f"READY:{addr}\n".encode())

    while True:
        try:
            line = ser.readline().decode().strip()
        except Exception:
            time.sleep(1)
            continue
        if not line:
            continue

        if line.startswith("CHALLENGE:"):
            challenge = line[10:]
            try:
                raw = bytes.fromhex(challenge)
                if len(raw) != 32:
                    ser.write(b"ERR:BAD_LENGTH\n")
                    continue
            except ValueError:
                ser.write(b"ERR:NOT_HEX\n")
                continue
            sig = sign_challenge(key, challenge)
            ser.write(f"SIGNATURE:{sig}\n".encode())

        elif line == "PING":
            ser.write(b"PONG\n")
        elif line == "ADDR":
            ser.write(f"ADDR:{addr}\n".encode())
        else:
            ser.write(b"ERR:UNKNOWN\n")

if __name__ == "__main__":
    main()
```
</details>

**Important:** Replace `RESIDENCY_ADDRESS` on line 10 with the residency's contract address (from its page at /r/[address]) before copying.

Make it executable and run at boot:

```bash
chmod +x /home/pi/zero-signer.py
```

Add to `/etc/rc.local` (before `exit 0`):
```
/home/pi/zero-signer.py &
```

### 1.6 What you should have now

| Item | Status |
|---|---|
| microSD with Raspberry Pi OS Lite | Boots |
| `dtoverlay=dwc2` in config.txt | USB gadget mode enabled |
| `g_serial` in cmdline.txt | Serial gadget loaded at boot |
| `/boot/seat.seed` | BIP-39 mnemonic for the seat key |
| `/home/pi/zero-signer.py` | Signing daemon, runs at boot |

---

## 2. Arduino wiring and sketch

### 2.1 Wiring

**USB connection:**
```
Pi 4 (USB-A port 2)  ──── USB-A to USB-B cable ────  Arduino Uno
```

**LED bar (10-segment):**

| LED bar pin | Connect to | Via |
|---|---|---|
| LED 1 anode | Arduino D2 | 220 Ω resistor |
| LED 2 anode | Arduino D3 | 220 Ω resistor |
| LED 3 anode | Arduino D4 | 220 Ω resistor |
| LED 4 anode | Arduino D5 | 220 Ω resistor |
| LED 5 anode | Arduino D6 | 220 Ω resistor |
| LED 6 anode | Arduino D7 | 220 Ω resistor |
| LED 7 anode | Arduino D8 | 220 Ω resistor |
| LED 8 anode | Arduino D9 | 220 Ω resistor |
| LED 9 anode | Arduino D10 | 220 Ω resistor |
| LED 10 anode | Arduino D11 | 220 Ω resistor |
| Common cathode | Arduino GND | Direct |

If your LED bar is **common anode** instead, wire the resistors to GND and the common pin to 5V. The Arduino code will need `digitalWrite(pin, LOW)` to light each LED.

**SG90 servo:**

| SG90 wire | Arduino pin |
|---|---|
| Signal (yellow/orange) | D12 |
| Power (red) | 5V |
| Ground (brown/black) | GND |

**Power note:** The servo draws ~200 mA. Power it from the Arduino's 5V pin, not from the Pi. If the servo causes brownouts, add a 470 µF capacitor between 5V and GND near the servo.

### 2.2 Arduino sketch

Upload this sketch via the Arduino IDE on your Mac:

<details>
<summary>Click to expand: seat-key-controller.ino</summary>

```cpp
// Seat Key Controller for an AI City residency
// Pi 4 sends single-character commands over USB serial.
// LED bar on D2-D11, servo latch on D12.

#include <Servo.h>

Servo latch;
const int LED_PINS[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
const int LED_COUNT = 10;
const int SERVO_PIN = 12;

const int SERVO_LOCKED = 0;
const int SERVO_UNLOCKED = 90;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  latch.attach(SERVO_PIN);
  latch.write(SERVO_LOCKED);
  Serial.println("OK:BOOT");
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();

    switch (cmd) {
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        setLEDs(cmd - '0');
        break;

      case 'O':  // Open door
        latch.write(SERVO_UNLOCKED);
        Serial.println("OK:UNLOCKED");
        break;

      case 'C':  // Close door
        latch.write(SERVO_LOCKED);
        Serial.println("OK:LOCKED");
        break;

      case 'R':  // Reset
        setLEDs(0);
        latch.write(SERVO_LOCKED);
        Serial.println("OK:RESET");
        break;

      case 'S':  // Status query
        Serial.print("LEDS:");
        Serial.print(currentLEDs());
        Serial.print(" DOOR:");
        Serial.println(latch.read() == SERVO_UNLOCKED ? "OPEN" : "LOCKED");
        break;

      default:
        Serial.print("ERR:UNKNOWN:");
        Serial.println(cmd);
        break;
    }
  }
}

void setLEDs(int count) {
  if (count < 0) count = 0;
  if (count > LED_COUNT) count = LED_COUNT;
  for (int i = 0; i < LED_COUNT; i++) {
    digitalWrite(LED_PINS[i], i < count ? HIGH : LOW);
  }
}

int currentLEDs() {
  int count = 0;
  for (int i = 0; i < LED_COUNT; i++) {
    if (digitalRead(LED_PINS[i]) == HIGH) count++;
  }
  return count;
}
```
</details>

### 2.3 Test the Arduino

From your Mac (before connecting to the Pi), open the Serial Monitor (115200 baud) and send:

```
R       → should reply "OK:RESET" (all LEDs off, door locked)
5       → 5 LEDs light up
O       → servo rotates to 90° (unlocked)
C       → servo rotates to 0° (locked)
0       → all LEDs off
S       → "LEDS:0 DOOR:LOCKED"
```

### 2.4 Cardboard door latch

Build a small house facade from cardboard:

1. Cut a door that swings on a tape hinge.
2. Hot-glue the SG90 behind the door frame.
3. Attach a small cardboard tab to the door that slides under the servo horn.
4. When the servo is at 0°, the tab is trapped → door stays closed.
5. When the servo rotates to 90°, the tab is free → door swings open.
6. Add a rubber band or spring to pull the door closed when the servo locks.

---

## 3. Pi 4 orchestrator

### 3.1 Prerequisites

On the Pi 4, install:

```bash
# Foundry (for cast)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Python deps
pip3 install pyserial aiofiles
```

Set environment variables (add to `~/.bashrc`):
```bash
export RESIDENCY_ADDRESS=0xYourResidencyContractAddress
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YourApiKey
```

### 3.2 The orchestrator script

Create `/home/pi/pi4-orchestrator.py`:

<details>
<summary>Click to expand: pi4-orchestrator.py</summary>

```python
#!/usr/bin/env python3
"""
Pi 4 Orchestrator for the Seat Key Demo
Connects:
  1. Residency contract via cast (every 5s)
  2. Arduino over /dev/ttyACM0 (LED bar + servo)
  3. Pi Zero over /dev/ttyGS0 (seat key signer)

When the Zero connects, the Pi 4 sends a random challenge.
The Zero signs it. The Pi 4 recovers the signer address and
checks the contract: the address has staked (getMember), the residency is
Active, and today is between startTime and endTime. If all pass, the door unlocks.
"""

import asyncio, os, random, time

# --- Config ---
CONTRACT = os.environ["RESIDENCY_ADDRESS"]
RPC = os.environ["RPC_URL"]
ARDUINO_PORT = "/dev/ttyACM0"
ZERO_PORT = "/dev/ttyGS0"
BAUD = 115200
POLL_SECONDS = 5
MAX_SEATS = 10

# --- Helpers ---

async def run_cast(*args):
    proc = await asyncio.create_subprocess_exec(
        "cast", *args, "--rpc-url", RPC,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip())
    return stdout.decode().strip()

async def get_seated_count():
    """Number of staked members (the contract's seatCount())."""
    result = await run_cast("call", CONTRACT, "seatCount()(uint256)")
    return int(result.split()[0])

async def is_seated(addr):
    """True if addr has staked and the residency's dates include today."""
    member = await run_cast("call", CONTRACT, "getMember(address)((bool,bool,bool,uint32,uint256))", addr)
    staked = member.strip("()").split(",")[1].strip() == "true"  # (approved, staked, claimed, bedId, price)
    start = int((await run_cast("call", CONTRACT, "startTime()(uint64)")).split()[0])
    end = int((await run_cast("call", CONTRACT, "endTime()(uint64)")).split()[0])
    return staked and start <= time.time() < end

async def get_status():
    """Residency status: 0=Open, 1=Active, 2=Failed, 3=Closed."""
    result = await run_cast("call", CONTRACT, "status()(uint8)")
    return {0: "Open", 1: "Active", 2: "Failed", 3: "Closed"}.get(int(result), "Unknown")

# --- Serial I/O ---

class SerialDevice:
    """Async wrapper around a serial port."""

    def __init__(self, port, baud, timeout=2):
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.reader = None
        self.writer = None

    async def connect(self):
        import serial_asyncio
        try:
            self.reader, self.writer = await serial_asyncio.open_serial_connection(
                url=self.port, baudrate=self.baud
            )
            return True
        except Exception as e:
            print(f"  [serial] {self.port}: {e}")
            return False

    async def send(self, data):
        if self.writer:
            self.writer.write(data.encode() if isinstance(data, str) else data)
            await self.writer.drain()

    async def readline(self):
        if self.reader:
            try:
                line = await asyncio.wait_for(self.reader.readline(), timeout=self.timeout)
                return line.decode().strip()
            except asyncio.TimeoutError:
                return None
        return None

# --- Main loop ---

async def main():
    print("=" * 50)
    print("Pi 4 Seat Key Orchestrator")
    print(f"Contract: {CONTRACT}")
    print(f"Arduino:  {ARDUINO_PORT}")
    print(f"Pi Zero:  {ZERO_PORT}")
    print("=" * 50)

    arduino = SerialDevice(ARDUINO_PORT, BAUD)
    zero = SerialDevice(ZERO_PORT, BAUD, timeout=5)

    arduino_ok = await arduino.connect()
    zero_connected = False
    zero_addr = None

    if not arduino_ok:
        print("[!] Arduino not found. LED bar and servo will be offline.")

    print("\nStarting poll loop...\n")

    while True:
        # --- Read onchain state ---
        try:
            count = await get_seated_count()
            status = await get_status()
            print(f"[chain] Seats: {count}/{MAX_SEATS}  Status: {status}")
        except Exception as e:
            print(f"[chain] Read failed: {e}")
            await asyncio.sleep(POLL_SECONDS)
            continue

        # --- Update LED bar ---
        if arduino_ok:
            seat_digit = str(min(count, 9))
            await arduino.send(seat_digit)

        # --- Try connecting the Zero ---
        if not zero_connected:
            ok = await zero.connect()
            if ok:
                line = await zero.readline()
                if line and line.startswith("READY:"):
                    zero_addr = line[6:]
                    zero_connected = True
                    print(f"[zero] Connected! Address: {zero_addr}")
                else:
                    print(f"[zero] Got unexpected boot message: {line}")
            else:
                print("[zero] Not connected (waiting...)")

        # --- If Zero is connected, verify the seat ---
        if zero_connected:
            challenge = os.urandom(32).hex()
            await zero.send(f"CHALLENGE:{challenge}\n")
            line = await zero.readline()

            if line is None:
                print("[zero] Timeout — may have disconnected")
                zero_connected = False
                zero_addr = None
                if arduino_ok:
                    await arduino.send("C")  # lock door
                await asyncio.sleep(POLL_SECONDS)
                continue

            if line.startswith("SIGNATURE:"):
                sig = line[10:]
                # Recover the signer address
                from eth_account import Account
                from eth_account.messages import encode_defunct
                message = challenge + CONTRACT.lower() + "ACCESS"
                try:
                    recovered = Account.recover_message(
                        encode_defunct(text=message), signature=sig
                    )
                except Exception as e:
                    print(f"[zero] Signature recovery failed: {e}")
                    await asyncio.sleep(POLL_SECONDS)
                    continue

                if recovered.lower() == zero_addr.lower():
                    seated = await is_seated(zero_addr)
                    if seated and status == "Active":
                        print(f"[zero] ✅ SEAT VERIFIED — unlocking door!")
                        if arduino_ok:
                            await arduino.send("O")
                        await asyncio.sleep(8)  # keep unlocked
                        if arduino_ok:
                            await arduino.send("C")
                        print("[zero] Door re-locked.")
                    else:
                        reason = "not seated" if not seated else f"status is {status}"
                        print(f"[zero] ❌ Access denied — {reason}")
                        if arduino_ok:
                            await arduino.send("C")  # ensure locked
                else:
                    print(f"[zero] ❌ Address mismatch: recovered={recovered}, claimed={zero_addr}")
            else:
                print(f"[zero] Unexpected response: {line}")
        else:
            # No Zero: ensure door is locked
            if arduino_ok:
                await arduino.send("C")

        await asyncio.sleep(POLL_SECONDS)

if __name__ == "__main__":
    asyncio.run(main())
```
</details>

### 3.3 Run it

```bash
export RESIDENCY_ADDRESS=0xYourContractAddress
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YourKey
python3 /home/pi/pi4-orchestrator.py
```

### 3.4 Auto-start (systemd)

Create `/etc/systemd/system/seat-key.service`:

```
[Unit]
Description=Residency Seat Key Orchestrator
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/pi4-orchestrator.py
WorkingDirectory=/home/pi
Environment=RESIDENCY_ADDRESS=0xYourContractAddress
Environment=RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YourKey
Restart=always
RestartSec=10
User=pi

[Install]
WantedBy=multi-user.target
```

Enable it:
```bash
sudo systemctl enable seat-key.service
sudo systemctl start seat-key.service
```

---

## 4. Connection test

### 4.1 Physical connections

```
┌───────── Power ─────────┐
Pi 4 from power bank (5V/3A USB-C)
Arduino powered over USB from Pi 4
Pi Zero powered from separate charger (PWR micro-USB)
                          │
┌───────── Data ──────────┐
Pi 4 USB-A port 1  ──── Pi Zero DATA micro-USB
Pi 4 USB-A port 2  ──── Arduino USB-B
```

### 4.2 Check serial devices

On the Pi 4:
```bash
ls -la /dev/ttyACM* /dev/ttyGS*
```

You should see:
```
/dev/ttyACM0   (Arduino)
/dev/ttyGS0    (Pi Zero, only when the Zero is plugged in AND running)
```

### 4.3 Manual test

1. Power the Pi 4. The LED bar should show 0 lit (or current seat count if the contract has stakes).
2. Power the Pi Zero from its PWR port.
3. Plug the Zero's DATA micro-USB into the Pi 4.
4. Wait 10 seconds. The Zero should appear as `/dev/ttyGS0`.
5. Run the orchestrator:
   ```bash
   python3 /home/pi/pi4-orchestrator.py
   ```
6. Within one poll cycle (5s), you should see:
   ```
   [zero] Connected! Address: 0x...
   [zero] ✅ SEAT VERIFIED — unlocking door!
   ```
7. The servo rotates, the door opens, and after 8 seconds it locks again.

### 4.4 What success looks like

```
==================================================
Pi 4 Seat Key Orchestrator
Contract: 0xYourContractAddress
Arduino:  /dev/ttyACM0
Pi Zero:  /dev/ttyGS0
==================================================

[chain] Seats: 4/10  Status: Active
[zero] Connected! Address: 0xabcd...1234
[zero] ✅ SEAT VERIFIED — unlocking door!
[zero] Door re-locked.
[chain] Seats: 4/10  Status: Active
```

---

## 5. Demo script (90 seconds)

| Time | Action | What the audience sees |
|---|---|---|
| 0:00 | Walk to the booth | LED bar shows 4/10 seats lit. Pi screen shows "Edge City Goa — Active" |
| 0:10 | "4 of 10 beds are staked. Here's the contract." | Point to Etherscan on the big screen |
| 0:25 | Hold up the Pi Zero. "This is a seat key. It has never touched the internet." | Show the two micro-USB ports: "Power in, data out. No Wi-Fi, no Bluetooth." |
| 0:35 | Plug the Zero into the Pi 4 | Pi screen: "Zero connected: 0xabcd... checking seat..." |
| 0:40 | Signature verified | Servo clicks. Door swings open. LED bar blinks once. |
| 0:50 | "Only a staked member during the residency dates can open this door." | Unplug Zero → door closes. Plug again → door opens. |
| 1:05 | "After the residency's end date, the door stops honouring the key. The key is a paperweight." | Show endTime-passed state (pre-recorded or fast-forward) |
| 1:15 | "The Zero only signs one format: challenge + residencyAddress + ACCESS. It can't be tricked into signing a transaction." | Hold up the 20-line signing script on screen |
| 1:30 | "A pop-up city is not a permanent settlement. Its keys should not outlive it." | Close |

---

## 6. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `/dev/ttyGS0` doesn't appear | dwc2/g_serial not loaded on Zero | Check `config.txt` and `cmdline.txt`. Run `sudo modprobe g_serial` on Zero |
| Zero doesn't respond | Wrong micro-USB port | The DATA port is labelled "USB" (closer to board edge). PWR port is labelled "PWR" or "ON" |
| Zero not powered | DATA port doesn't supply power | Connect a separate charger to the Zero's PWR port |
| `/dev/ttyACM0` missing | Arduino not detected | Check USB cable. Run `dmesg \| grep tty` on Pi 4 |
| Servo jitters or doesn't move | Power brownout | Power servo from Arduino 5V, not Pi. Add 470 µF cap |
| LED bar all on or all off | Common anode vs. cathode mismatch | Invert `HIGH`/`LOW` in the Arduino code |
| `cast call` fails | No RPC access | Check network. Use `--rpc-url` with a working key |
| Zero's `eth-account` fails | Wrong Python version | `pip3 install eth-account==0.13.0` |
| Door doesn't close cleanly | Servo horn alignment | Adjust the horn position. Use `SERVO_LOCKED = 5` (not 0) for a tighter hold |
| Signature recovery fails | Address case mismatch | Both Zero and Pi 4 must use lowercase addresses |

### 6.1 Quick debug commands

On the Pi 4:
```bash
# Test Arduino directly
echo 'S' > /dev/ttyACM0 && cat /dev/ttyACM0
# Expected: "LEDS:4 DOOR:LOCKED"

# Test Zero directly
echo -e "PING\n" > /dev/ttyGS0 && cat /dev/ttyGS0
# Expected: "PONG"

# Check contract
cast call $RESIDENCY_ADDRESS "seatCount()(uint256)" --rpc-url $RPC_URL

# Recover address from a signed message (test on Mac)
python3 -c "
from eth_account import Account
from eth_account.messages import encode_defunct
msg = encode_defunct(text='abc' + '0xresidency' + 'ACCESS')
sig = '...'  # paste signature from Zero
print(Account.recover_message(msg, signature=sig))
"
```

---

## 7. Files in this repo

| File | Location | Purpose |
|---|---|---|
| `docs/pi-zero-seat-key-guide.md` | This file | Full setup guide |
| `web/hardware/arduino/seat-key-controller.ino` | `web/hardware/arduino/` | Arduino sketch |
| `web/hardware/pi-zero/zero-signer.py` | `web/hardware/pi-zero/` | Pi Zero signing daemon |
| `web/hardware/pi4/pi4-orchestrator.py` | `web/hardware/pi4/` | Pi 4 main orchestrator |
| `web/hardware/pi4/seat-key.service` | `web/hardware/pi4/` | systemd unit for auto-start |

### 7.1 Create the hardware directory

```bash
mkdir -p web/hardware/arduino web/hardware/pi-zero web/hardware/pi4
```

Copy the scripts from the code blocks above into their respective files. See the sections above for each file's exact contents.