#!/usr/bin/env python3
"""
Pi 4 seat-key door: Pi Zero wallet on USB, SG90 latch on GPIO 12.

Plug the Zero's USB data port into the Pi 4. The Zero (running
zero-tx-signer.py) shows up as a USB serial device. The Pi 4 sends a random
challenge, the Zero signs it with its wallet key (EIP-191 personal message),
and the Pi 4 recovers the signer address and checks it against DOOR_RULE.
If it passes, the latch opens for DOOR_OPEN_SECONDS, then locks again.
One open per insertion: unplug and replug the key to open again.

Door rules (DOOR_RULE):
  pair    the first key presented is enrolled; after that only that address opens
  staked  the residency's host(), or getMember(addr).staked is true
  active  host or staked, status() is Active, and startTime <= now < endTime

Servo: hardware PWM0 on GPIO 12 (pin 32) from `dtoverlay=pwm,pin=12,func=4`,
written through sysfs, so there's no software-timing jitter. Servo power comes
from the breadboard power module; its ground is tied to Pi pin 34.

Check-ins: the challenge comes from the AI City app (GET /api/residencies/<r>/door/challenge),
and after the door opens the signature is posted to /door/checkins, which verifies it and flips
the wallet between in and out for the board's "In the house" list. If the app can't be reached,
the door uses a local challenge and still opens; that entry just isn't recorded.

Config is read from the environment; aicity-door.service loads
/boot/firmware/door.env, which can be edited from the Mac.

Usage:  pi4-door.py [run | open | close | test]
"""

import glob, json, os, queue, re, secrets, sys, threading, time, urllib.error, urllib.request

from eth_abi import decode as abi_decode, encode as abi_encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import function_signature_to_4byte_selector

# ── Configuration ──────────────────────────────────────────
RULE = os.environ.get("DOOR_RULE", "pair")
RPC_URL = os.environ.get("RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com")
BOARD_URL_FILE = "/boot/firmware/board-url.txt"
PAIRED_FILE = "/var/lib/aicity-door/paired-address"
OPEN_SECONDS = float(os.environ.get("DOOR_OPEN_SECONDS", "30"))
LOCKED = float(os.environ.get("LOCKED_ANGLE", "0"))
UNLOCKED = float(os.environ.get("UNLOCKED_ANGLE", "90"))
KEY_PORT = os.environ.get("DOOR_SERIAL")  # default: auto-detect the Zero's gadget port
APP_URL = os.environ.get("APP_URL", "").rstrip("/")  # default: the origin in board-url.txt
DOOR_API_KEY = os.environ.get("DOOR_API_KEY", "")
PWM = "/sys/class/pwm/pwmchip0"
# ──────────────────────────────────────────────────────────


_status_queue = queue.Queue()


def _status_worker():
    while True:
        status, message = _status_queue.get()
        try:
            data = json.dumps({"status": status, "message": message[:200]}).encode()
            req = urllib.request.Request(
                app_url() + f"/api/residencies/{residency_address()}/door/status",
                data, {"Content-Type": "application/json",
                       "x-door-key": DOOR_API_KEY,
                       "User-Agent": "aicity-door/1"})
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            log(f"door status not sent: {e}")  # advisory; the door never waits on it


def door_status(status, message=""):
    """Queue the door state for the board's banner (checking, opening, open, denied, locked).
    Sent in order by one background thread, so a slow network never delays the latch."""
    if not DOOR_API_KEY or not app_url():
        return
    if not getattr(door_status, "started", False):
        threading.Thread(target=_status_worker, daemon=True).start()
        door_status.started = True
    _status_queue.put((status, message))


def log(msg):
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def residency_address():
    """RESIDENCY_ADDRESS, or the /r/<address>/board in the kiosk's board-url.txt."""
    addr = os.environ.get("RESIDENCY_ADDRESS", "").strip()
    if not addr and os.path.exists(BOARD_URL_FILE):
        m = re.search(r"/r/(0x[0-9a-fA-F]{40})", open(BOARD_URL_FILE).read())
        addr = m.group(1) if m else ""
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", addr):
        sys.exit("No residency address: set RESIDENCY_ADDRESS or board-url.txt")
    return addr.lower()


def app_url():
    if APP_URL:
        return APP_URL
    if os.path.exists(BOARD_URL_FILE):
        m = re.search(r"https?://[^/\s]+", open(BOARD_URL_FILE).read())
        if m:
            return m.group(0)
    return ""


def app_request(path, body=None):
    headers = {"User-Agent": "aicity-door/1"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(app_url() + path, data, headers)
    try:
        return json.load(urllib.request.urlopen(req, timeout=10))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read().decode(errors='replace')[:200]}")


def door_message(residency, challenge):
    # Must match door_message() in pi-zero/zero-tx-signer.py
    return f"AI City door access\nresidency: {residency}\nchallenge: {challenge}"


# ── Servo (hardware PWM through sysfs) ─────────────────────

def pwm_write(name, value):
    with open(f"{PWM}/pwm0/{name}", "w") as f:
        f.write(str(value))


def set_latch(angle):
    if not os.path.exists(f"{PWM}/pwm0"):
        with open(f"{PWM}/export", "w") as f:
            f.write("0")
        time.sleep(0.2)  # udev sets up pwm0
    pwm_write("period", 20_000_000)  # 50 Hz
    pwm_write("duty_cycle", int(500_000 + 2_000_000 * angle / 180))  # 0.5-2.5 ms
    pwm_write("enable", 1)
    time.sleep(0.6)
    pwm_write("enable", 0)  # stop driving so the SG90 doesn't buzz


# ── Chain reads (plain JSON-RPC eth_call) ──────────────────

def eth_call(residency, sig, arg_types=(), args=(), out_types=("uint256",)):
    data = function_signature_to_4byte_selector(sig) + abi_encode(list(arg_types), list(args))
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_call",
                       "params": [{"to": residency, "data": "0x" + data.hex()}, "latest"]})
    # publicnode rejects urllib's default User-Agent with a 403
    headers = {"Content-Type": "application/json", "User-Agent": "aicity-door/1"}
    req = urllib.request.Request(RPC_URL, body.encode(), headers)
    reply = json.load(urllib.request.urlopen(req, timeout=10))
    if "error" in reply:
        raise RuntimeError(reply["error"])
    raw = bytes.fromhex(reply["result"].removeprefix("0x"))
    if not raw:
        raise RuntimeError(f"no contract at {residency} on this RPC")
    return abi_decode(list(out_types), raw)


def allowed(residency, addr):
    """Returns (ok, reason) for the configured DOOR_RULE."""
    if RULE == "pair":
        if not os.path.exists(PAIRED_FILE):
            os.makedirs(os.path.dirname(PAIRED_FILE), exist_ok=True)
            with open(PAIRED_FILE, "w") as f:
                f.write(addr + "\n")
            return True, "enrolled as this door's key"
        paired = open(PAIRED_FILE).read().strip()
        return addr.lower() == paired.lower(), f"paired key is {paired}"

    (host,) = eth_call(residency, "host()", out_types=["address"])
    if host.lower() == addr.lower():
        who = "host"
    else:
        _, staked, *_ = eth_call(residency, "getMember(address)", ["address"], [addr],
                                 ["bool", "bool", "bool", "uint32", "uint256"])
        if not staked:
            return False, "not the host and has not staked in this residency"
        who = "staked"
    if RULE == "staked":
        return True, who

    (status,) = eth_call(residency, "status()", out_types=["uint8"])
    (start,) = eth_call(residency, "startTime()", out_types=["uint64"])
    (end,) = eth_call(residency, "endTime()", out_types=["uint64"])
    if status != 1:
        return False, f"residency status is {['Open', 'Active', 'Failed', 'Closed'][status]}"
    if not start <= time.time() < end:
        return False, "outside the residency dates"
    return True, f"{who}, residency active"


# ── The Zero ───────────────────────────────────────────────

def find_key():
    if KEY_PORT:
        return KEY_PORT if os.path.exists(KEY_PORT) else None
    for pattern in ("/dev/serial/by-id/*Gadget*", "/dev/ttyACM*"):
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[0]
    return None


def ask(ser, command, prefix, wait, progress=None):
    """Send command every 2 s until a line starting with prefix arrives.
    progress(elapsed) is called every 15 s while waiting."""
    start = time.time()
    deadline = start + wait
    next_progress = start + 15
    while time.time() < deadline:
        if progress and time.time() >= next_progress:
            progress(time.time() - start)
            next_progress += 15
        ser.write((command + "\n").encode())
        resend = time.time() + 2
        while time.time() < min(resend, deadline):
            line = ser.readline().decode(errors="replace").strip()
            if line.startswith(prefix):
                return line[len(prefix):]
            if line.startswith("ERR:"):
                raise RuntimeError(f"Zero refused {command.split(':')[0]}: {line}")
    raise TimeoutError(f"no {prefix!r} reply to {command.split(':')[0]}")


def handle_key(port, residency):
    import serial
    door_status("checking", "Seat key plugged in. It's starting up.")
    t0 = time.time()
    with serial.Serial(port, 115200, timeout=0.5) as ser:
        # The Zero boots off the Pi's USB power. The serial port appears partway through
        # its boot, and the signer answers once Python has loaded.
        pong = ask(ser, "PING", "PONG", wait=300,
                   progress=lambda s: log(f"waiting for the key's signer, {s:.0f}s"))
        log(f"key awake after {time.time() - t0:.1f}s on the port ({pong.strip() or 'no uptime'})")
        door_status("checking", "Key is awake. Checking its signature.")
        try:
            challenge = app_request(f"/api/residencies/{residency}/door/challenge")["challenge"]
            from_app = True
        except Exception as e:
            log(f"app unreachable, local challenge, check-in won't be recorded: {e}")
            challenge, from_app = secrets.token_hex(32), False
        sig = ask(ser, f"DOOR:{residency}:{challenge}", "DOOR_SIG:", wait=10)
    signer = Account.recover_message(encode_defunct(text=door_message(residency, challenge)),
                                     signature=sig)
    ok, reason = allowed(residency, signer)
    if not ok:
        log(f"DENIED {signer}: {reason}")
        door_status("denied", f"{signer[:10]}... {reason}")
        return
    log(f"OPEN {signer}: {reason}")
    door_status("opening", f"{signer[:10]}... {reason}")
    set_latch(UNLOCKED)
    door_status("open", f"{signer[:10]}... {reason}")
    opened = time.time()
    if from_app:  # recorded while the latch is open, so a slow network doesn't delay the door
        try:
            c = app_request(f"/api/residencies/{residency}/door/checkins",
                            {"challenge": challenge, "signature": sig})["checkin"]
            log(f"checked {c['direction']}: {c['address']}")
        except Exception as e:
            log(f"check-in not recorded: {e}")
    time.sleep(max(0, OPEN_SECONDS - (time.time() - opened)))
    set_latch(LOCKED)
    door_status("locked", "")
    log("locked")


def run():
    residency = residency_address()
    log(f"door up: rule={RULE} residency={residency}")
    set_latch(LOCKED)
    while True:
        port = find_key()
        if not port:
            time.sleep(1)
            continue
        log(f"key on {port}")
        try:
            handle_key(port, residency)
        except Exception as e:
            log(f"key error: {type(e).__name__}: {e}")
            door_status("denied", f"Key error: {e}. Unplug it and try again.")
        while os.path.exists(port):  # one open per insertion
            time.sleep(1)
        log("key removed")


def test():
    for angle in (LOCKED, UNLOCKED, LOCKED):
        log(f"latch -> {angle}")
        set_latch(angle)
        time.sleep(1)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    {"run": run, "test": test,
     "open": lambda: set_latch(UNLOCKED),
     "close": lambda: set_latch(LOCKED)}[cmd]()
