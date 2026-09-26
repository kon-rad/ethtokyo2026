#!/usr/bin/env python3
"""
Pi Zero Offline Seat Key Signer
Runs over USB serial gadget mode. No Wi-Fi, no network.
Reads seed from /boot/seat.seed.
Only signs: challenge + residencyAddress + "ACCESS"
Never signs arbitrary data or transactions.

Usage: runs at boot via /etc/rc.local.
       Connects on /dev/ttyAMA0 when plugged into a Pi 4.
"""

import os, sys, time
from eth_account import Account
from eth_account.messages import encode_defunct

# ── Configuration ──────────────────────────────────────────
SEED_FILE = "/boot/seat.seed"
RESIDENCY_ADDRESS = "0x0000000000000000000000000000000000000000"  # ← REPLACE ME
SERIAL_PORT = "/dev/ttyAMA0"
BAUD = 115200
# ──────────────────────────────────────────────────────────

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

    # Wait for serial device to appear (USB gadget mode)
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