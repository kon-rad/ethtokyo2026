#!/usr/bin/env python3
"""
Pi 4 GPIO board: seat bar + latch without the Arduino.

For a Pi 4 whose 3.5" screen covers GPIO pins 1-26. Everything runs off the
free pins 27-40:

  LED bar segments 1-8 -> GPIO 5, 6, 13, 19, 26, 16, 20, 21
                          (pins 29, 31, 33, 35, 37, 36, 38, 40), one resistor each
  SG90 servo signal    -> GPIO 12 (pin 32); servo power from a separate 5 V rail
  Ground               -> pin 34, shared with the servo's 5 V supply

Usage:
  pi4-gpio-board.py test     sweep the LED bar, open and close the latch
  pi4-gpio-board.py open     unlock the latch
  pi4-gpio-board.py close    lock the latch
  pi4-gpio-board.py run      poll the Residency contract, show seatCount() on the bar

`run` needs RESIDENCY_ADDRESS and RPC_URL, and Foundry's `cast` on PATH.
The latch stays locked in `run`: opening it needs the Pi Zero seat key
(see pi4-orchestrator.py).
"""

import os, subprocess, sys, time
from gpiozero import AngularServo, LEDBarGraph

LED_PINS = (5, 6, 13, 19, 26, 16, 20, 21)
SERVO_PIN = 12
LOCKED, UNLOCKED = 0, 90
POLL_SECONDS = 5

bar = LEDBarGraph(*LED_PINS)
latch = AngularServo(
    SERVO_PIN, min_angle=0, max_angle=180,
    min_pulse_width=0.0005, max_pulse_width=0.0025,  # SG90 range
)

def set_latch(angle):
    latch.angle = angle
    time.sleep(0.6)
    latch.detach()  # stop the pulse so the servo doesn't jitter at rest

def show_seats(count):
    bar.value = min(count, len(LED_PINS)) / len(LED_PINS)

# ── Chain reads ────────────────────────────────────────────

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

# ── Commands ───────────────────────────────────────────────

def test():
    for n in range(len(LED_PINS) + 1):
        show_seats(n)
        print(f"LEDs: {n}")
        time.sleep(0.4)
    show_seats(0)
    print("Latch: open"); set_latch(UNLOCKED)
    time.sleep(1)
    print("Latch: closed"); set_latch(LOCKED)

def run():
    print(f"Contract: {os.environ['RESIDENCY_ADDRESS']}")
    set_latch(LOCKED)
    while True:
        try:
            count, state = seat_count(), status()
            show_seats(count)
            print(f"[chain] Seats: {count}  Status: {state}", flush=True)
        except subprocess.CalledProcessError as e:
            print(f"[chain] Read failed: {e.stderr.strip()}", flush=True)
        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "test"
    {"test": test, "run": run,
     "open": lambda: set_latch(UNLOCKED),
     "close": lambda: set_latch(LOCKED)}[cmd]()
