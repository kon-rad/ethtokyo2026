# House Environment Monitor — Pi 4 Direct Wiring Guide
### Breadboard sensors + I2C LCD + servo on the Pi 4, no Arduino

**Goal:** Wire the thermistor, photoresistor, HC-SR04 ultrasonic, I2C 16×2 LCD and an SG90 servo directly to the Pi 4 through the T-cobbler breakout board. All parts are on the desk. The LCD sits on the Pi header, and the ribbon cable + breakout gives access to everything else.

---

## The pin situation

The 3.5" LCD sits on GPIO pins 1–26. Those pins are taken. The solution:

1. **LCD stays on the Pi header** (pins 1–26) — it drives the main display.
2. **Ribbon cable** plugs into the Pi header on top of the LCD (most LCDs have a passthrough). The other end goes to the **T-cobbler breakout board** on the breadboard.
3. **All sensors and the servo wire into the breakout.** Only pins 27–40 are available on the breakout's far side, plus the I2C pins (3/5) which the LCD typically passes through.

**If the LCD doesn't pass through the ribbon:** seat the LCD on the Pi, plug the ribbon into the LCD's own header (many have one), and the breakout at the other end. If that doesn't work either, you can run the sensors on the breadboard using the breakout connected to the Pi via the ribbon directly (remove the LCD temporarily during setup).

---

## Parts list (all on the desk)

| Part | From | Qty |
|---|---|---|
| Raspberry Pi 4 Model B | Desk (loose one, not the car) | 1 |
| 40-pin ribbon cable | Freenove kit | 1 |
| T-cobbler GPIO breakout board | Freenove kit (on the breadboard) | 1 |
| Full breadboard | Freenove kit | 1 |
| HC-SR04 ultrasonic sensor | Desk | 1 |
| Thermistor (NTC, 10k @ 25°C) | Freenove kit | 1 |
| Photoresistor (LDR) | Freenove kit | 1 |
| ADC module (PCF8591 or ADS7830, I2C) | Freenove kit | 1 |
| I2C 16×2 LCD (QAPASS, blue trim pot) | Desk (with I2C backpack) | 1 |
| SG90 micro servo | Desk (blue, in bag with horns) | 1 |
| Resistors: 220Ω × 4, 1kΩ × 2, 10kΩ × 3 | Freenove kit | as above |
| Jumper wires (M-M, M-F) | Freenove kit | bundle |
| Breadboard power module (MB102) | Desk | 1 |

---

## Circuit diagram

```
                  ┌──────────────────────────────────────────┐
                  │         Raspberry Pi 4                    │
                  │                                           │
                  │  GPIO header (1-26) ──── 3.5" LCD         │
                  │         │                                  │
                  │         └── ribbon cable ── T-cobbler ──▶  Breadboard
                  │                                           │
                  │  USB ── power for LCD + Pi                 │
                  └──────────────────────────────────────────┘

Breadboard layout (T-cobbler at centre):

  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │ 3V3  │ 5V   │ GND  │ GND  │ 3V3  │ 5V   │ GND  │ 3V3  │  T-cobbler row
  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  │GPIO2 │GPIO3 │GPIO4 │GPIO17│GPIO27│GPIO22│GPIO23│GPIO24│
  │ SDA  │ SCL  │ TRIG │ ECHO │      │      │      │      │
  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  │ GND  │GPIO25│GPIO5 │GPIO6 │GPIO12│GPIO13│GPIO19│GPIO16│
  │      │      │      │      │SERVO │ ADC  │      │      │
  │      │      │      │      │PWM   │INT   │      │      │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

---

## Wiring instructions (step by step)

### Step 0: Set up the breadboard

1. Plug the T-cobbler into the breadboard at the centre, straddling the centre channel. The ribbon cable connects to the Pi.
2. If using the MB102 breadboard power module, set it to 5 V and plug it into the breadboard power rails. This powers the servo and sensors without loading the Pi's 3.3 V regulator.

### Step 1: I2C LCD (16×2, 4 wires)

The LCD backpack has a PCF8574 I2C chip. Connect it to the T-cobbler's I2C pins:

| LCD backpack | T-cobbler pin | Wire |
|---|---|---|
| VCC | 5 V (pin 2 or 4 rail) | Red |
| GND | GND (pin 6 rail) | Black |
| SDA | GPIO2 / SDA (pin 3 rail) | Yellow |
| SCL | GPIO3 / SCL (pin 5 rail) | Green |

**The LCD uses I2C address 0x27 or 0x3F.** We'll check which one in the software step.

**Note:** If the LCD doesn't light up, the I2C backpack may have a different address. The blue trim pot on the backpack adjusts contrast — turn it gently with a screwdriver until the characters are visible.

### Step 2: HC-SR04 ultrasonic (4 pins, with voltage divider on Echo)

The HC-SR04 runs at 5 V but its Echo pin outputs 5 V. The Pi GPIO is 3.3 V tolerant, so Echo needs a voltage divider: 1k + 2k resistors. You have 1k resistors in the kit; use two 1k in series to make 2k.

```
HC-SR04                 Pi GPIO
┌──────┐
│ VCC  ─── 5 V (power rail)
│ TRIG ─── GPIO4 (pin 7 on T-cobbler, or pin 7 on the Pi header if passed through)
│ ECHO ───┬── 1k resistor ── GPIO17 (pin 11)
│         │
│         └── 2k resistor (two 1k in series) ── GND
│ GND  ─── GND
└──────┘
```

The voltage divider drops 5 V to about 3.3 V: `3.3 = 5 × 2000 / (1000 + 2000)`.

| HC-SR04 pin | Connected to |
|---|---|
| VCC | 5 V rail |
| TRIG | GPIO4 (pin 7) |
| ECHO | 1k resistor → GPIO17 (pin 11); 2k resistor (2 × 1k) → GND |
| GND | GND rail |

### Step 3: ADC module (PCF8591 or ADS7830) for thermistor + photoresistor

The Pi has no analogue inputs. The Freenove kit includes an ADC module. It's either a **PCF8591** (4-channel, 8-bit ADC + 1 DAC, I2C address 0x48) or an **ADS7830** (8-channel, 8-bit ADC, I2C address 0x48). Both use I2C and both work the same way for this project.

| ADC module | T-cobbler pin | Wire |
|---|---|---|
| VCC | 3.3 V or 5 V (check module label — most work at 3.3 V) | Red |
| GND | GND | Black |
| SDA | GPIO2 / SDA (same I2C bus as the LCD) | Yellow |
| SCL | GPIO3 / SCL | Green |
| AIN0 (or CH0) | Thermistor voltage divider output | Orange |
| AIN1 (or CH1) | Photoresistor voltage divider output | Blue |

**Thermistor voltage divider:**
```
3.3 V ──┬── 10k resistor ──┬── AIN0 (ADC channel 0)
        │                  │
        │              thermistor
        │                  │
        └────────────────── GND
```

Wire: 10k resistor from 3.3 V rail to breadboard row A. Thermistor from row A to GND. The junction (row A) goes to AIN0.

**Photoresistor voltage divider (same pattern):**
```
3.3 V ──┬── 10k resistor ──┬── AIN1 (ADC channel 1)
        │                  │
        │            photoresistor
        │                  │
        └────────────────── GND
```

Wire: 10k resistor from 3.3 V rail to breadboard row B. Photoresistor from row B to GND. The junction (row B) goes to AIN1.

### Step 4: SG90 servo (3 wires)

The servo needs a PWM signal on a PWM-capable GPIO, plus 5 V power (not 3.3 V — the SG90 draws more than the Pi's 3.3 V regulator can supply).

| Servo wire | Connected to |
|---|---|
| Brown (or black) — GND | GND rail |
| Red — power | 5 V rail |
| Orange (or yellow) — signal | GPIO12 (pin 32) — PWM0 |

**Important:** Power the servo from the breadboard's 5 V rail (from the MB102 module or directly from the Pi's 5 V pin). Do NOT power it from the Pi's 3.3 V pin — it will brown out the Pi.

---

## Final pin assignment summary

| Pin | GPIO | Connected to | Notes |
|---|---|---|---|
| 1 | 3.3 V | ADC VCC, voltage divider tops | |
| 2 | 5 V | LCD VCC, HC-SR04 VCC, servo power | Through the breadboard rail |
| 3 | GPIO2 (SDA) | LCD SDA, ADC SDA | Shared I2C bus |
| 5 | GPIO3 (SCL) | LCD SCL, ADC SCL | Shared I2C bus |
| 6 | GND | Common ground | |
| 7 | GPIO4 | HC-SR04 TRIG | |
| 11 | GPIO17 | HC-SR04 ECHO (via voltage divider) | |
| 32 | GPIO12 (PWM0) | Servo signal | |

---

## Software setup

### Step 1: Enable I2C on the Pi

```bash
sudo raspi-config
# → Interface Options → I2C → Enable
# Reboot
sudo reboot
```

### Step 2: Check the I2C bus

```bash
# After reboot, list I2C devices
sudo i2cdetect -y 1
```

You should see two addresses:
- `0x27` or `0x3f` — the LCD backpack
- `0x48` — the ADC module (PCF8591 or ADS7830)

If you only see one, check the wiring of the missing device.

### Step 3: Install Python dependencies

```bash
pip3 install smbus2 RPi.GPIO
```

For the LCD, install the `lcd_i2c` library (or use `RPLCD`):

```bash
pip3 install RPLCD smbus2
```

### Step 4: Install the collector script

Same `collector.py` from the build plan (`Projects/ai-city/docs/house-environment-monitor-build-plan.md`), but with a Pi GPIO backend instead of serial.

Create `/home/pi/house-env/collector-pi4.py`:

```python
#!/usr/bin/env python3
"""
AI City House Environment Collector — Pi 4 direct GPIO version.

Reads:
  - Thermistor via ADC module (I2C)
  - Photoresistor via ADC module (I2C)
  - HC-SR04 ultrasonic via GPIO
  - (Servo is output-only, controlled separately)
  - I2C LCD for local display

Writes the same house-env-latest.json and house-env.ndjson as the Arduino version.
"""

import json
import os
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import RPi.GPIO as GPIO
from smbus2 import SMBus

# --- Configuration ---
DATA_DIR = Path("/home/pi/house-env/data")
SUMMARY_FILE = DATA_DIR / "house-env-latest.json"
CITY_SLUG = "penang-2026"  # change to your city slug

# GPIO pins
TRIG_PIN = 4   # HC-SR04 Trig
ECHO_PIN = 17  # HC-SR04 Echo (via voltage divider)
SERVO_PIN = 12  # SG90 signal (PWM0)

# I2C addresses (check with i2cdetect)
ADC_ADDRESS = 0x48  # PCF8591 or ADS7830
LCD_ADDRESS = 0x27  # or 0x3F — check with i2cdetect

# ADC channel assignments
THERMISTOR_CH = 0  # AIN0
LIGHT_CH = 1       # AIN1

# Door detection settings
DISTANCE_THRESHOLD_CM = 30
BASELINE_WINDOW_SECONDS = 300
DOOR_CLOSED_CONFIRM_SECONDS = 10

# Rolling buffers
distance_window = deque(maxlen=BASELINE_WINDOW_SECONDS)
temp_readings = deque(maxlen=3600)
light_readings = deque(maxlen=3600)

# Door state
door_open = False
door_open_time = None
door_closed_since = None
door_events_today = []

# Summary timing
last_summary_time = 0


def setup_gpio():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(TRIG_PIN, GPIO.OUT)
    GPIO.setup(ECHO_PIN, GPIO.IN)
    GPIO.setup(SERVO_PIN, GPIO.OUT)
    GPIO.output(TRIG_PIN, False)
    print("[GPIO] Setup complete", flush=True)


def read_distance():
    """Read HC-SR04 and return distance in cm, or 0 on timeout."""
    GPIO.output(TRIG_PIN, True)
    time.sleep(0.00001)
    GPIO.output(TRIG_PIN, False)

    pulse_start = time.time()
    pulse_end = time.time()

    # Wait for echo to go high (with 30 ms timeout)
    timeout = time.time() + 0.03
    while GPIO.input(ECHO_PIN) == 0 and time.time() < timeout:
        pulse_start = time.time()
    if time.time() >= timeout:
        return 0

    # Wait for echo to go low (with 30 ms timeout)
    timeout = time.time() + 0.03
    while GPIO.input(ECHO_PIN) == 1 and time.time() < timeout:
        pulse_end = time.time()
    if time.time() >= timeout:
        return 0

    pulse_duration = pulse_end - pulse_start
    distance = pulse_duration * 17150  # speed of sound in cm/s
    return round(distance, 1)


def read_adc(bus, channel):
    """Read an ADC channel (0-3 for PCF8591, 0-7 for ADS7830)."""
    try:
        # PCF8591 protocol: control byte = 0x40 + channel
        bus.write_byte(ADC_ADDRESS, 0x40 + channel)
        bus.read_byte(ADC_ADDRESS)  # dummy read
        value = bus.read_byte(ADC_ADDRESS)
        return value
    except OSError as e:
        print(f"[ADC] Read error on channel {channel}: {e}", flush=True)
        return 0


def get_baseline():
    if len(distance_window) < 10:
        return None
    sorted_d = sorted(distance_window)
    return sorted_d[len(sorted_d) // 2]


def check_door(distance_cm, now):
    global door_open, door_open_time, door_closed_since

    baseline = get_baseline()
    if baseline is None:
        return

    delta = abs(distance_cm - baseline)

    if not door_open and delta > DISTANCE_THRESHOLD_CM:
        door_open = True
        door_open_time = now
        door_closed_since = None
        print(f"[DOOR] Opened at {now.isoformat()} (delta={delta:.0f}cm)", flush=True)

    elif door_open:
        if delta < DISTANCE_THRESHOLD_CM / 2:
            if door_closed_since is None:
                door_closed_since = now
            elif (now - door_closed_since).total_seconds() >= DOOR_CLOSED_CONFIRM_SECONDS:
                duration = (now - door_open_time).total_seconds()
                door_events_today.append({
                    "at": door_open_time.isoformat(),
                    "durationSeconds": int(duration),
                })
                print(f"[DOOR] Closed after {int(duration)}s", flush=True)
                door_open = False
                door_open_time = None
                door_closed_since = None
        else:
            door_closed_since = None


def write_summary(now):
    if len(temp_readings) == 0:
        return

    summary = {
        "city": CITY_SLUG,
        "updatedAt": now.isoformat(),
        "status": "online",
        "current": {
            "temperature": int(temp_readings[-1]),
            "light": int(light_readings[-1]),
            "distance": int(distance_window[-1]) if distance_window else 0,
        },
        "lastHour": {
            "temperature": {
                "min": int(min(temp_readings)),
                "max": int(max(temp_readings)),
                "avg": int(sum(temp_readings) / len(temp_readings)),
            },
            "light": {
                "min": int(min(light_readings)),
                "max": int(max(light_readings)),
                "avg": int(sum(light_readings) / len(light_readings)),
            },
        },
        "doorEvents": door_events_today[-20:],
        "doorOpen": door_open,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_FILE.write_text(json.dumps(summary, indent=2))
    print(f"[SUMMARY] Written at {now.isoformat()}", flush=True)


def write_ndjson(now, record):
    """Append one record to today's NDJSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    today_str = now.strftime("%Y-%m-%d")
    ndjson_file = DATA_DIR / f"house-env-{today_str}.ndjson"

    with open(ndjson_file, "a") as f:
        f.write(json.dumps(record, separators=(",", ":")) + "\n")

    # Cleanup old files (>7 days)
    for f in DATA_DIR.glob("house-env-*.ndjson"):
        if f == ndjson_file:
            continue
        try:
            fdate = datetime.strptime(f.stem.replace("house-env-", ""), "%Y-%m-%d")
            if (now - fdate.replace(tzinfo=now.tzinfo)).days > 7:
                f.unlink()
        except ValueError:
            pass


def set_servo_angle(angle):
    """Set the servo to an angle (0-180)."""
    pwm = GPIO.PWM(SERVO_PIN, 50)  # 50 Hz
    pwm.start(0)
    duty = angle / 18 + 2.5
    pwm.ChangeDutyCycle(duty)
    time.sleep(0.5)
    pwm.stop()


def update_lcd(bus, lcd, temperature, light, distance):
    """Update the I2C LCD with current readings. Uses RPLCD library."""
    from RPLCD import i2c as LCD

    if lcd is None:
        try:
            lcd = LCD.CharLCD(f'I2C(expander="PCF8574", address={hex(LCD_ADDRESS)})')
            lcd.clear()
        except:
            return None

    try:
        lcd.cursor_pos = (0, 0)
        lcd.write_string(f"T:{temperature} L:{light}")
        lcd.cursor_pos = (1, 0)
        lcd.write_string(f"D:{distance}cm")
    except:
        pass

    return lcd


def main():
    print("[COLLECTOR] Starting — Pi 4 direct GPIO mode", flush=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    setup_gpio()

    # Initialise I2C
    try:
        bus = SMBus(1)
        print("[I2C] Bus opened", flush=True)
    except Exception as e:
        print(f"[I2C] Failed to open bus: {e}", flush=True)
        bus = None

    # Initialise LCD
    lcd = None

    # Quick servo test: sweep to 90° (centre) on startup
    try:
        set_servo_angle(90)
        print("[SERVO] Initialised to 90°", flush=True)
    except Exception as e:
        print(f"[SERVO] Init failed: {e}", flush=True)

    try:
        while True:
            now = datetime.now(timezone.utc)

            # Read sensors
            distance = read_distance()
            if bus:
                temp_raw = read_adc(bus, THERMISTOR_CH)
                light_raw = read_adc(bus, LIGHT_CH)
            else:
                temp_raw = 0
                light_raw = 0

            record = {
                "t": now.isoformat(),
                "T": temp_raw,
                "L": light_raw,
                "D": int(distance),
            }

            # Write to NDJSON
            write_ndjson(now, record)

            # Update buffers
            distance_window.append(int(distance))
            temp_readings.append(temp_raw)
            light_readings.append(light_raw)

            # Door detection
            if distance > 0:
                check_door(distance, now)

            # Update LCD (every 5 seconds to avoid flicker)
            if int(time.time()) % 5 == 0:
                lcd = update_lcd(lcd, temp_raw, light_raw, int(distance))

            # Write summary every 60 seconds
            if time.time() - last_summary_time >= 60:
                write_summary(now)
                last_summary_time = time.time()

            time.sleep(1)

    except KeyboardInterrupt:
        print("[COLLECTOR] Shutting down", flush=True)
        write_summary(datetime.now(timezone.utc))
    finally:
        GPIO.cleanup()
        if bus:
            bus.close()
        if lcd:
            lcd.clear()
            lcd.close()


if __name__ == "__main__":
    main()
```

### Step 5: Run it

```bash
# Make it executable
chmod +x /home/pi/house-env/collector-pi4.py

# Run manually first
python3 /home/pi/house-env/collector-pi4.py

# In another terminal, check the output
cat /home/pi/house-env/data/house-env-latest.json
```

### Step 6: systemd service

Same as the Arduino version, just point to the new script:

```bash
sudo nano /etc/systemd/system/house-env.service
```

```ini
[Unit]
Description=AI City House Environment Collector (Pi 4 GPIO)
After=multi-user.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/house-env
ExecStart=/usr/bin/python3 /home/pi/house-env/collector-pi4.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable house-env.service
sudo systemctl start house-env.service
sudo journalctl -u house-env.service -f
```

---

## What the I2C LCD shows

Once running, the LCD displays:

```
Line 1: T:312 L:540    (thermistor ADC, light ADC)
Line 2: D:85cm         (ultrasonic distance)
```

The servo sweeps to centre (90°) on startup as a visual confirmation. You can later map it to a needle gauge for the funding level or the temperature trend.

---

## Verification checklist

| Test | What to do | Expected |
|---|---|---|
| I2C devices | `sudo i2cdetect -y 1` | Two addresses: 0x27/0x3F (LCD) and 0x48 (ADC) |
| Thermistor | Hold it between your fingers | `T` value rises in the JSON |
| Photoresistor | Cover it with your hand | `L` value drops toward 0 |
| Ultrasonic | Wave your hand in front | `D` value changes; door events appear |
| LCD | Watch the display | Updates every 5 seconds with live values |
| Servo | On startup | Sweeps to 90° then stays |
| API | `curl localhost:3000/api/.../environment` | Returns valid JSON |
| systemd | `sudo systemctl status house-env` | Running, restarts on crash |

---

## Comparison: Pi 4 direct vs. Arduino

| | Pi 4 direct (this guide) | Arduino (from the build plan) |
|---|---|---|
| Parts needed | ADC module (in kit), voltage divider for HC-SR04 | Arduino Uno, no ADC needed |
| Wiring complexity | More (voltage divider, I2C bus) | Less (all 5 V, direct analogue) |
| Software complexity | One Python script, no serial parsing | Arduino sketch + Pi serial collector |
| LCD | I2C backpack, shares bus with ADC | I2C or parallel |
| Servo | PWM via GPIO, needs 5 V rail | PWM via Arduino pin |
| Best for | Single-device setup, no extra microcontroller | Teaching, separation of concerns |

Either path produces the same `house-env-latest.json` and `house-env.ndjson` files, so the API route and dapp tab are identical.