#!/usr/bin/env python3
"""
Pi 4 Orchestrator for the Seat Key Door System
Connects:
  1. Residency contract via cast (every 5s)
  2. Arduino over /dev/ttyACM0 (LED bar + servo)
  3. Pi Zero over /dev/ttyGS0 (seat key signer)

When the Zero connects, the Pi 4 sends a random challenge.
The Zero signs it. The Pi 4 recovers the signer address and
checks the contract: the address has staked (getMember), the residency is
Active, and today is between startTime and endTime. If all pass, the door unlocks.

It also checks the pairing message to ensure it's valid for this residency.
"""
import asyncio, os, random, time
from typing import Optional

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

async def get_pairing_message() -> Optional[str]:
    """Get the pairing message for this residency (if any)."""
    try:
        # This would typically come from a database or configuration
        # For now, we'll return a placeholder - in practice this would be retrieved from the backend
        return os.environ.get("PAIRING_MESSAGE", None)
    except Exception:
        return None

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
    print("Pi 4 Seat Key Door System Orchestrator")
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
                        # Check pairing message
                        pairing_msg = await get_pairing_message()
                        if pairing_msg:
                            # Send pairing message to Zero to verify
                            await zero.send(f"PAIRING\n")
                            pairing_line = await zero.readline()
                            if pairing_line and pairing_line.startswith("PAIRING:"):
                                stored_pairing = pairing_line[8:]  # Remove "PAIRING:"
                                if stored_pairing == pairing_msg:
                                    print(f"[zero] ✅ SEAT VERIFIED AND PAIRED — unlocking door!")
                                    if arduino_ok:
                                        await arduino.send("O")
                                    await asyncio.sleep(8)  # keep unlocked
                                    if arduino_ok:
                                        await arduino.send("C")
                                    print("[zero] Door re-locked.")
                                else:
                                    print(f"[zero] ❌ Pairing mismatch: expected {pairing_msg}, got {stored_pairing}")
                                    if arduino_ok:
                                        await arduino.send("C")  # ensure locked
                            else:
                                print(f"[zero] ❌ Pairing verification failed: {pairing_line}")
                                if arduino_ok:
                                    await arduino.send("C")  # ensure locked
                        else:
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