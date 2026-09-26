#!/usr/bin/env python3
"""
Pi Zero offline transaction signer.

The Zero never touches a network. It talks to the Mac over one USB cable
(serial gadget, /dev/ttyGS0 on the Zero, /dev/cu.usbmodem* on the Mac).
The Mac builds the unsigned transaction and broadcasts the signed one;
the key only ever exists on this SD card.

On first start it generates a BIP-39 mnemonic and stores it at KEY_FILE (0600).
It never sends the mnemonic or private key over serial.

Protocol, one line each way:
  PING                -> PONG
  ADDR                -> ADDR:<address>
  SIGN:<tx json>      -> SIGNED:<json {raw, hash, from, summary}>  or  ERR:<reason>

Policy, checked before signing (override with environment variables):
  ZERO_CHAIN_IDS      comma-separated allowed chain ids   (default 11155111, Sepolia)
  ZERO_MAX_VALUE_WEI  max ETH value per transaction, wei  (default 0.05 ETH)
  ZERO_MAX_FEE_WEI    max gas * maxFeePerGas, wei         (default 0.02 ETH)

Usage:  runs at boot via zero-tx-signer.service.
        `zero-tx-signer.py address` prints the address and exits.
"""

import json, os, sys, time

from eth_abi import decode as abi_decode
from eth_account import Account
from eth_utils import function_signature_to_4byte_selector, to_checksum_address

# ── Configuration ──────────────────────────────────────────
KEY_FILE = os.environ.get("ZERO_KEY_FILE", "/var/lib/zero-signer/mnemonic")
SERIAL_PORT = os.environ.get("ZERO_SERIAL_PORT", "/dev/ttyGS0")
BAUD = 115200
CHAIN_IDS = {int(c) for c in os.environ.get("ZERO_CHAIN_IDS", "11155111").split(",")}
MAX_VALUE_WEI = int(os.environ.get("ZERO_MAX_VALUE_WEI", str(5 * 10**16)))
MAX_FEE_WEI = int(os.environ.get("ZERO_MAX_FEE_WEI", str(2 * 10**16)))
# ──────────────────────────────────────────────────────────

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
SELECTORS = {
    function_signature_to_4byte_selector(f"{name}({','.join(types)})"): (types, label)
    for name, types, label in KNOWN_FUNCTIONS
}


def load_or_create_key():
    Account.enable_unaudited_hdwallet_features()
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE) as f:
            return Account.from_mnemonic(f.read().strip())
    os.makedirs(os.path.dirname(KEY_FILE), mode=0o700, exist_ok=True)
    acct, mnemonic = Account.create_with_mnemonic()
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(mnemonic + "\n")
        f.flush()
        os.fsync(f.fileno())
    print(f"KEYGEN: new key {acct.address} written to {KEY_FILE}", flush=True)
    return acct


def describe_call(data):
    if len(data) == 0:
        return "plain ETH transfer"
    if len(data) < 4:
        raise ValueError("calldata shorter than a selector")
    known = SELECTORS.get(data[:4])
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
    acct = load_or_create_key()
    if sys.argv[1:] == ["address"]:
        print(acct.address)
        return
    print(f"BOOT:{acct.address} chains={sorted(CHAIN_IDS)}", flush=True)

    import serial
    while not os.path.exists(SERIAL_PORT):
        time.sleep(1)
    ser = serial.Serial(SERIAL_PORT, BAUD, timeout=None)

    while True:
        try:
            line = ser.readline().decode(errors="replace").strip()
        except Exception:
            time.sleep(1)
            continue
        if not line:
            continue

        if line == "PING":
            reply = "PONG"
        elif line == "ADDR":
            reply = f"ADDR:{acct.address}"
        elif line.startswith("SIGN:"):
            try:
                reply = "SIGNED:" + json.dumps(sign(acct, line[5:]))
            except Exception as e:
                reply = f"ERR:{type(e).__name__}: {e}"
                print(reply, flush=True)
        else:
            reply = "ERR:UNKNOWN_COMMAND"
        ser.write((reply + "\n").encode())


if __name__ == "__main__":
    main()
