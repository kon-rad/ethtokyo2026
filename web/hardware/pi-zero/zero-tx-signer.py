#!/usr/bin/env python3
"""
Pi Zero offline transaction signer.

The Zero never touches a network. It talks to the Mac over one USB cable
(serial gadget, /dev/ttyGS0 on the Zero, /dev/cu.usbmodem* on the Mac).
The Mac builds the unsigned transaction and broadcasts the signed one;
the key only ever exists on this SD card.

On first start it generates a BIP-39 mnemonic and stores it at KEY_FILE (0600).
KEY_FILE can instead hold an imported private key (0x + 64 hex). With
ZERO_EXPECTED_ADDRESS set, it refuses to run unless the key derives exactly
that address, and it never generates a key of its own.
It never sends the mnemonic or private key over serial.

Protocol, one line each way:
  PING                -> PONG
  ADDR                -> ADDR:<address>
  SIGN:<tx json>      -> SIGNED:<json {raw, hash, from, summary}>  or  ERR:<reason>
  DOOR:<residency>:<32-byte hex challenge>
                      -> DOOR_SIG:<signature>, an EIP-191 signature over door_message().
                         The Pi 4 door (pi4/pi4-door.py) recovers the address from it.
                         Both fields are format-checked, so this can't sign anything else.

Policy, checked before signing (override with environment variables):
  ZERO_CHAIN_IDS      comma-separated allowed chain ids   (default 11155111, Sepolia)
  ZERO_MAX_VALUE_WEI  max ETH value per transaction, wei  (default 0.05 ETH)
  ZERO_MAX_FEE_WEI    max gas * maxFeePerGas, wei         (default 0.02 ETH)

  ZERO_STATUS_FILE    optional; gets "OK <address>" or "ERROR <reason>" at start, so an
                      offline Zero with no screen can be checked by reading its SD card

Boot speed: the Zero cold-boots every time it's plugged into the door, and importing
eth_account on an ARMv6 core takes tens of seconds (pydantic, and py_ecc builds its BLS
pairing tables at import). So the door path (PING, ADDR, DOOR) uses only pycryptodome's
keccak and the small secp256k1 signer below, and eth_account is imported only when needed:
for SIGN, or once to turn a mnemonic into a private key. That key is cached next to the
mnemonic (DOOR_KEY_CACHE, 0600) with a hash of the mnemonic, so later boots skip it.
PONG carries the Zero's uptime ("PONG up=41.2 ready=39.8") so the door can log boot time.

Usage:  runs at boot via zero-tx-signer.service.
        `zero-tx-signer.py address` prints the address and exits.
"""

import hashlib, hmac, json, os, re, sys, time

# ── Configuration ──────────────────────────────────────────
KEY_FILE = os.environ.get("ZERO_KEY_FILE", "/var/lib/zero-signer/mnemonic")
SERIAL_PORT = os.environ.get("ZERO_SERIAL_PORT", "/dev/ttyGS0")
BAUD = 115200
CHAIN_IDS = {int(c) for c in os.environ.get("ZERO_CHAIN_IDS", "11155111").split(",")}
MAX_VALUE_WEI = int(os.environ.get("ZERO_MAX_VALUE_WEI", str(5 * 10**16)))
MAX_FEE_WEI = int(os.environ.get("ZERO_MAX_FEE_WEI", str(2 * 10**16)))
EXPECTED_ADDRESS = os.environ.get("ZERO_EXPECTED_ADDRESS", "").strip().lower()
STATUS_FILE = os.environ.get("ZERO_STATUS_FILE")
DOOR_KEY_CACHE = os.path.join(os.path.dirname(KEY_FILE), "derived-key")
# ──────────────────────────────────────────────────────────

DOOR_RE = re.compile(r"DOOR:(0x[0-9a-fA-F]{40}):([0-9a-f]{64})")


def door_message(residency, challenge):
    # Must match door_message() in pi4/pi4-door.py
    return f"AI City door access\nresidency: {residency.lower()}\nchallenge: {challenge}"


# Functions the Zero can name and decode offline. Anything else signs as "unknown call".
KNOWN_FUNCTIONS = [
    # Residency
    ("approve", ["address", "uint32", "uint256"], "Residency.approve(member, bedId, price)"),
    ("revoke", ["address"], "Residency.revoke(member)"),
    ("cancel", [], "Residency.cancel()"),
    ("withdraw", ["uint256", "bytes32", "string"], "Residency.withdraw(amount, receiptHash, note)"),
    ("close", [], "Residency.close()"),
    ("sweep", [], "Residency.sweep()"),
    ("transferHost", ["address"], "Residency.transferHost(newHost)"),
    ("acceptHost", [], "Residency.acceptHost()"),
    ("stake", ["uint256"], "Residency.stake(expectedPrice)"),
    ("claim", [], "Residency.claim()"),
    # ResidencyFactory
    ("createResidency", ["(bytes32,uint64,uint64,uint64,uint32,uint32)"],
     "ResidencyFactory.createResidency((metadataHash, startTime, endTime, deadline, minSeats, maxSeats))"),
    # ERC-20 (USDC)
    ("approve", ["address", "uint256"], "ERC20.approve(spender, amount)"),
    ("transfer", ["address", "uint256"], "ERC20.transfer(to, amount)"),
]


def selectors():
    from eth_utils import function_signature_to_4byte_selector
    return {
        function_signature_to_4byte_selector(f"{name}({','.join(types)})"): (types, label)
        for name, types, label in KNOWN_FUNCTIONS
    }


# ── secp256k1 for the door path ────────────────────────────
# The same math as eth_keys' pure-Python backend (Jacobian coordinates, the same
# deterministic nonce), so signatures are byte-identical to eth_account's
# sign_message. Not constant-time, like that backend.
SECP_P = 2**256 - 2**32 - 977
SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECP_G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
          0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)


def _jdouble(p):
    x, y, z = p
    if not y:
        return (0, 0, 1)
    ysq = y * y % SECP_P
    s = 4 * x * ysq % SECP_P
    m = 3 * x * x % SECP_P
    nx = (m * m - 2 * s) % SECP_P
    return nx, (m * (s - nx) - 8 * ysq * ysq) % SECP_P, 2 * y * z % SECP_P


def _jadd(p, q):
    if not p[1]:
        return q
    if not q[1]:
        return p
    u1 = p[0] * q[2] ** 2 % SECP_P
    u2 = q[0] * p[2] ** 2 % SECP_P
    s1 = p[1] * q[2] ** 3 % SECP_P
    s2 = q[1] * p[2] ** 3 % SECP_P
    if u1 == u2:
        return _jdouble(p) if s1 == s2 else (0, 0, 1)
    h, r = u2 - u1, s2 - s1
    h2 = h * h % SECP_P
    h3 = h * h2 % SECP_P
    u1h2 = u1 * h2 % SECP_P
    nx = (r * r - h3 - 2 * u1h2) % SECP_P
    return nx, (r * (u1h2 - nx) - s1 * h3) % SECP_P, h * p[2] * q[2] % SECP_P


def _mul_g(k):
    acc, base = (0, 0, 1), (SECP_G[0], SECP_G[1], 1)
    for bit in bin(k)[2:]:
        acc = _jdouble(acc)
        if bit == "1":
            acc = _jadd(acc, base)
    zinv = pow(acc[2], -1, SECP_P)
    return acc[0] * zinv ** 2 % SECP_P, acc[1] * zinv ** 3 % SECP_P


def keccak(data):
    from Crypto.Hash import keccak as k  # pycryptodome, already installed for eth_hash
    return k.new(digest_bits=256, data=data).digest()


def address_of(key):
    x, y = _mul_g(int.from_bytes(key, "big"))
    addr = keccak(x.to_bytes(32, "big") + y.to_bytes(32, "big"))[-20:].hex()
    check = keccak(addr.encode()).hex()  # EIP-55 checksum
    return "0x" + "".join(c.upper() if int(check[i], 16) >= 8 else c for i, c in enumerate(addr))


def sign_personal(key, text):
    """EIP-191 personal_sign over text; returns the 65-byte r||s||v signature, v 27/28."""
    msg = text.encode()
    h = keccak(b"\x19Ethereum Signed Message:\n" + str(len(msg)).encode() + msg)
    d = int.from_bytes(key, "big")
    v0, k0 = b"\x01" * 32, b"\x00" * 32
    k1 = hmac.new(k0, v0 + b"\x00" + key + h, hashlib.sha256).digest()
    v1 = hmac.new(k1, v0, hashlib.sha256).digest()
    k2 = hmac.new(k1, v1 + b"\x01" + key + h, hashlib.sha256).digest()
    v2 = hmac.new(k2, v1, hashlib.sha256).digest()
    k = int.from_bytes(hmac.new(k2, v2, hashlib.sha256).digest(), "big")
    if not 0 < k < SECP_N:
        raise ValueError("bad nonce")
    x, y = _mul_g(k)
    r = x % SECP_N
    s = pow(k, -1, SECP_N) * (int.from_bytes(h, "big") + r * d) % SECP_N
    if not r or not s:
        raise ValueError("bad signature")
    v = 27 + ((y & 1) ^ (0 if s * 2 < SECP_N else 1))
    s = min(s, SECP_N - s)
    return r.to_bytes(32, "big") + s.to_bytes(32, "big") + bytes([v])


def uptime():
    try:
        return float(open("/proc/uptime").read().split()[0])
    except OSError:
        return 0.0


def write_status(text):
    if not STATUS_FILE:
        return
    try:
        if os.path.exists(STATUS_FILE) and open(STATUS_FILE).read() == text + "\n":
            return  # don't rewrite the SD card on every restart
        with open(STATUS_FILE, "w") as f:
            f.write(text + "\n")
    except OSError:
        pass


def write_secret(path, text):
    tmp = path + ".tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(text + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def key_from_mnemonic(mnemonic):
    """eth_account's derivation, cached: its import is the slow part of a Zero boot."""
    tag = hashlib.sha256(mnemonic.encode()).hexdigest()
    if os.path.exists(DOOR_KEY_CACHE):
        cached_tag, _, cached_key = open(DOOR_KEY_CACHE).read().strip().partition(" ")
        if cached_tag == tag and re.fullmatch(r"[0-9a-f]{64}", cached_key):
            return bytes.fromhex(cached_key)
    from eth_account import Account
    Account.enable_unaudited_hdwallet_features()
    key = bytes(Account.from_mnemonic(mnemonic).key)
    write_secret(DOOR_KEY_CACHE, f"{tag} {key.hex()}")
    return key


def load_or_create_key():
    """Returns (private key bytes, checksummed address)."""
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE) as f:
            secret = f.read().strip()
        if re.fullmatch(r"(0x)?[0-9a-fA-F]{64}", secret):
            key = bytes.fromhex(secret.removeprefix("0x"))
        else:
            key = key_from_mnemonic(secret)
        address = address_of(key)
        if EXPECTED_ADDRESS and address.lower() != EXPECTED_ADDRESS:
            raise SystemExit(f"key in {KEY_FILE} is {address}, expected {EXPECTED_ADDRESS}")
        return key, address
    if EXPECTED_ADDRESS:
        raise SystemExit(f"no key at {KEY_FILE}; expected an imported key for {EXPECTED_ADDRESS}")
    from eth_account import Account
    Account.enable_unaudited_hdwallet_features()
    os.makedirs(os.path.dirname(KEY_FILE), mode=0o700, exist_ok=True)
    acct, mnemonic = Account.create_with_mnemonic()
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(mnemonic + "\n")
        f.flush()
        os.fsync(f.fileno())
    print(f"KEYGEN: new key {acct.address} written to {KEY_FILE}", flush=True)
    return key_from_mnemonic(mnemonic), acct.address


def describe_call(data):
    if len(data) == 0:
        return "plain ETH transfer"
    if len(data) < 4:
        raise ValueError("calldata shorter than a selector")
    from eth_abi import decode as abi_decode
    known = selectors().get(data[:4])
    if not known:
        return f"unknown call, selector 0x{data[:4].hex()}"
    types, label = known
    try:
        args = abi_decode(types, data[4:])
    except Exception:
        return f"{label} with undecodable args"
    return f"{label} args={[a.hex() if isinstance(a, bytes) else a for a in args]}"


def parse_tx(raw_json):
    """Validate the Mac's unsigned tx and apply the policy. Returns (tx, summary)."""
    from eth_utils import to_checksum_address
    t = json.loads(raw_json)
    tx = {
        "type": 2,
        "chainId": int(t["chainId"]),
        "nonce": int(t["nonce"]),
        "to": to_checksum_address(t["to"]),
        "value": int(t.get("value", 0)),
        "data": bytes.fromhex(t.get("data", "0x").removeprefix("0x")),
        "gas": int(t["gas"]),
        "maxFeePerGas": int(t["maxFeePerGas"]),
        "maxPriorityFeePerGas": int(t["maxPriorityFeePerGas"]),
    }
    if tx["chainId"] not in CHAIN_IDS:
        raise ValueError(f"chainId {tx['chainId']} not allowed (allowed: {sorted(CHAIN_IDS)})")
    if tx["value"] > MAX_VALUE_WEI:
        raise ValueError(f"value {tx['value']} wei over cap {MAX_VALUE_WEI}")
    if tx["gas"] * tx["maxFeePerGas"] > MAX_FEE_WEI:
        raise ValueError(f"max fee {tx['gas'] * tx['maxFeePerGas']} wei over cap {MAX_FEE_WEI}")
    if tx["maxPriorityFeePerGas"] > tx["maxFeePerGas"]:
        raise ValueError("maxPriorityFeePerGas above maxFeePerGas")
    summary = {
        "chainId": tx["chainId"],
        "nonce": tx["nonce"],
        "to": tx["to"],
        "valueWei": tx["value"],
        "call": describe_call(tx["data"]),
        "maxFeeWei": tx["gas"] * tx["maxFeePerGas"],
    }
    return tx, summary


def sign(acct, raw_json):
    tx, summary = parse_tx(raw_json)
    signed = acct.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    print(f"SIGNED: nonce {tx['nonce']} to {tx['to']} {summary['call']}", flush=True)
    return {"raw": "0x" + raw.hex().removeprefix("0x"),
            "hash": "0x" + signed.hash.hex().removeprefix("0x"),
            "from": acct.address, "summary": summary}


def main():
    try:
        key, address = load_or_create_key()
    except (SystemExit, ValueError) as e:
        write_status(f"ERROR {e}")  # ValueError: a key file that isn't a key or a mnemonic
        raise SystemExit(f"KEY: {e}")
    write_status(f"OK {address}")
    if sys.argv[1:] == ["address"]:
        print(address)
        return
    print(f"BOOT:{address} chains={sorted(CHAIN_IDS)} up={uptime():.1f}", flush=True)

    import serial
    while not os.path.exists(SERIAL_PORT):
        time.sleep(1)
    ser = serial.Serial(SERIAL_PORT, BAUD, timeout=None)
    ready = uptime()
    acct = None  # eth_account, loaded on the first SIGN

    while True:
        try:
            line = ser.readline().decode(errors="replace").strip()
        except Exception:
            time.sleep(1)
            continue
        if not line:
            continue

        if line == "PING":
            reply = f"PONG up={uptime():.1f} ready={ready:.1f}"
        elif line == "ADDR":
            reply = f"ADDR:{address}"
        elif line.startswith("SIGN:"):
            try:
                if acct is None:
                    from eth_account import Account
                    acct = Account.from_key(key)
                reply = "SIGNED:" + json.dumps(sign(acct, line[5:]))
            except Exception as e:
                reply = f"ERR:{type(e).__name__}: {e}"
                print(reply, flush=True)
        elif line.startswith("DOOR:"):
            m = DOOR_RE.fullmatch(line)
            if m:
                reply = "DOOR_SIG:0x" + sign_personal(key, door_message(*m.groups())).hex()
                print(f"DOOR: signed access challenge for {m.group(1)}", flush=True)
            else:
                reply = "ERR:BAD_DOOR_CHALLENGE"
        else:
            reply = "ERR:UNKNOWN_COMMAND"
        ser.write((reply + "\n").encode())


if __name__ == "__main__":
    main()
