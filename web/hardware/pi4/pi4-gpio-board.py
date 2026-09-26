#!/usr/bin/env python3
"""
Pi 4 GPIO board: I2C LCD seat display + servo latch without the Arduino.

For a Pi 4 whose 3.5" screen covers GPIO pins 1-26. Everything runs off the
free pins 27-40:

  I2C LCD (QAPASS HW-061, PCF8574 backpack)  -> SDA=pin 3 (GPIO2), SCL=pin 5 (GPIO3)
  SG90 servo signal                           -> GPIO 12 (pin 32)
  Servo power                                 -> breadboard power module +5 V rail
  Shared ground                               -> Pi pin 34

The LCD uses the hardware I2C bus (pins 3/5 are *not* under the screen on a
Pi 4 — they're on the outer edge near pin 1 but still accessible). If the
screen physically blocks them, use software I2C on pins 27 (GPIO0) / 28 (GPIO1)
or switch to GPIO 23 (pin 16) / GPIO 24 (pin 18) for bit-banged I2C.

Usage:
  pi4-gpio-board.py test     show seats on LCD, open and close the latch
  pi4-gpio-board.py open     unlock the latch
  pi4-gpio-board.py close    lock the latch
  pi4-gpio-board.py run      poll the Residency contract, show seatCount() on LCD

`run` needs RESIDENCY_ADDRESS and RPC_URL, and Foundry's `cast` on PATH.
The latch stays locked in `run`: opening it needs the Pi Zero seat key
(see pi4-orchestrator.py).
"""

import os, subprocess, sys, time

from gpiozero import AngularServo

# ── I2C LCD ──────────────────────────────────────────────

try:
    from RPLCD.i2c import CharLCD
except ImportError:
    # Fallback: install hint
    print("Install the I2C LCD library: sudo pip3 install RPLCD smbus2", file=sys.stderr)
    sys.exit(1)

I2C_ADDR = 0x27  # common for HW-061 / PCF8574 backpack; try 0x3f if blank

def find_lcd_addr():
    """Probe for the I2C backpack address so the user doesn't have to guess."""
    import smbus2
    for addr in (0x27, 0x3f, 0x20, 0x21):
        try:
            bus = smbus2.SMBus(1)
            bus.read_byte(addr)
            bus.close()
            return addr
        except OSError:
            continue
    return None

addr = find_lcd_addr()
if addr is None:
    print("No I2C LCD found. Check wiring and run: sudo i2cdetect -y 1", file=sys.stderr)
    sys.exit(1)

lcd = CharLCD(i2c_expander='PCF8574', address=addr, port=1,
              cols=16, rows=2, dotsize=8)
lcd.clear()

# ── Servo ────────────────────────────────────────────────

SERVO_PIN = 12
LOCKED, UNLOCKED = 0, 90

latch = AngularServo(
    SERVO_PIN, min_angle=0, max_angle=180,
    min_pulse_width=0.0005, max_pulse_width=0.0025,  # SG90 range
)

def set_latch(angle):
    latch.angle = angle
    time.sleep(0.6)
    latch.detach()

def show_seats(count):
    lcd.clear()
    lcd.write_string(f"Seats: {count}/8")
    lcd.cursor_pos = (1, 0)
    bar = "█" * min(count, 8) + "░" * (8 - min(count, 8))
    lcd.write_string(bar)

# ── Chain reads ──────────────────────────────────────────

def cast_call(sig):
    out = subprocess.run(
        ["cast", "call", os.environ["RESIDENCY_ADDRESS"], sig,
         "--rpc-url", os.environ["RPC_URL"]],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()

def seat_count():
    return int(cast_call("seatCount()(uint256)").split()[0])

def status():
    """Residency status: 0=Open, 1=Active, 2=Failed, 3=Closed."""
    return {0: "Open", 1: "Active", 2: "Failed", 3: "Closed"}.get(
        int(cast_call("status()(uint8)")), "Unknown"
    )

# ── Commands ─────────────────────────────────────────────

def test():
    lcd.clear()
    lcd.write_string("TEST: bar sweep")
    time.sleep(1)
    for n in range(9):
        show_seats(n)
        time.sleep(0.4)
    time.sleep(0.5)
    lcd.clear()
    lcd.write_string("TEST: latch open")
    set_latch(UNLOCKED)
    time.sleep(1)
    lcd.clear()
    lcd.write_string("TEST: latch close")
    set_latch(LOCKED)
    time.sleep(0.5)
    lcd.clear()
    lcd.write_string("All good!")

def run():
    print(f"Contract: {os.environ['RESIDENCY_ADDRESS']}")
    set_latch(LOCKED)
    while True:
        try:
            count, state = seat_count(), status()
            show_seats(count)
            lcd.cursor_pos = (1, 0)
            lcd.write_string(f"█" * min(count, 8) + f"░" * (8 - min(count, 8)))
            lcd.cursor_pos = (0, 10)
            lcd.write_string(state[:6])
            print(f"[chain] Seats: {count}  Status: {state}", flush=True)
        except subprocess.CalledProcessError as e:
            lcd.clear()
            lcd.write_string("Chain err")
            print(f"[chain] Read failed: {e.stderr.strip()}", flush=True)
        time.sleep(5)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "test"
    {"test": test, "run": run,
     "open": lambda: set_latch(UNLOCKED),
     "close": lambda: set_latch(LOCKED)}[cmd]()