#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyserial"]
# ///
"""
Mac side of the Pi Zero offline signer (zero-tx-signer.py).

Builds an unsigned EIP-1559 transaction from the chain (nonce, fees, gas),
sends it to the Zero over USB serial, and broadcasts what comes back.
The Mac never sees the key.

Usage:
  uv run cold-sign.py addr
  uv run cold-sign.py send --to 0xResidency --sig 'stake(uint256)' 250000000
  uv run cold-sign.py send --to 0xUSDC --sig 'approve(address,uint256)' 0xResidency 250000000
  uv run cold-sign.py send --to 0xFriend --value 0.001
  uv run cold-sign.py send ... --no-broadcast   # sign only, print the raw tx

Calldata is encoded with Foundry's `cast calldata`. RPC comes from --rpc,
then $RPC_URL, then a public Sepolia endpoint.
"""

import argparse, glob, json, os, subprocess, sys, time, urllib.request
from decimal import Decimal

import serial

PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
EXPLORERS = {11155111: "https://sepolia.etherscan.io/tx/", 1: "https://etherscan.io/tx/"}


def rpc(url, method, *params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": list(params)}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "User-Agent": "cold-sign"})
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if "error" in out:
        raise SystemExit(f"RPC {method} failed: {out['error']}")
    return out["result"]


def find_port(explicit):
    if explicit:
        return explicit
    ports = sorted(glob.glob("/dev/cu.usbmodem*"))
    if len(ports) != 1:
        raise SystemExit(f"expected one /dev/cu.usbmodem* port, found {ports or 'none'}; pass --port")
    return ports[0]


def zero(port, command, timeout=60):
    """Send one line to the Zero, return its one-line reply."""
    with serial.Serial(port, 115200, timeout=timeout) as ser:
        ser.reset_input_buffer()
        ser.write((command + "\n").encode())
        reply = ser.readline().decode(errors="replace").strip()
    if not reply:
        raise SystemExit("no reply from the Zero (is zero-tx-signer.service running?)")
    if reply.startswith("ERR:"):
        raise SystemExit(f"Zero refused: {reply[4:]}")
    return reply


def zero_address(port):
    return zero(port, "ADDR").removeprefix("ADDR:")


def build_tx(url, sender, to, value_wei, data):
    chain_id = int(rpc(url, "eth_chainId"), 16)
    nonce = int(rpc(url, "eth_getTransactionCount", sender, "pending"), 16)
    base_fee = int(rpc(url, "eth_getBlockByNumber", "latest", False)["baseFeePerGas"], 16)
    priority = int(rpc(url, "eth_maxPriorityFeePerGas"), 16)
    call = {"from": sender, "to": to, "value": hex(value_wei), "data": data}
    gas = int(rpc(url, "eth_estimateGas", call), 16) * 12 // 10
    return {
        "chainId": chain_id, "nonce": nonce, "to": to, "value": value_wei, "data": data,
        "gas": gas, "maxFeePerGas": 2 * base_fee + priority, "maxPriorityFeePerGas": priority,
    }


def cmd_send(args, url):
    port = find_port(args.port)
    sender = zero_address(port)
    data = "0x"
    if args.sig:
        data = subprocess.check_output(["cast", "calldata", args.sig, *args.args], text=True).strip()
    elif args.data:
        data = args.data
    value_wei = int(Decimal(args.value) * 10**18)

    tx = build_tx(url, sender, args.to, value_wei, data)
    print(f"from   {sender}")
    print(f"to     {tx['to']}")
    print(f"call   {args.sig or data} {' '.join(args.args)}")
    print(f"value  {args.value} ETH   chain {tx['chainId']}   nonce {tx['nonce']}")
    print(f"max fee {Decimal(tx['gas'] * tx['maxFeePerGas']) / 10**18:.6f} ETH")
    if input("Send to the Zero to sign? [y/N] ").strip().lower() != "y":
        raise SystemExit("cancelled")

    signed = json.loads(zero(port, "SIGN:" + json.dumps(tx)).removeprefix("SIGNED:"))
    print(f"\nZero decoded: {signed['summary']['call']}")
    print(f"signed hash   {signed['hash']}")
    if signed["from"].lower() != sender.lower():
        raise SystemExit("Zero signed from an unexpected address; not broadcasting")
    if args.no_broadcast:
        print(f"raw tx        {signed['raw']}")
        return

    tx_hash = rpc(url, "eth_sendRawTransaction", signed["raw"])
    print(f"broadcast     {EXPLORERS.get(tx['chainId'], '')}{tx_hash}")
    for _ in range(60):
        receipt = rpc(url, "eth_getTransactionReceipt", tx_hash)
        if receipt:
            ok = receipt["status"] == "0x1"
            print(f"{'mined' if ok else 'REVERTED'} in block {int(receipt['blockNumber'], 16)}")
            sys.exit(0 if ok else 1)
        time.sleep(3)
    print("not mined after 3 minutes; check the explorer")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--port", help="serial port (default: the only /dev/cu.usbmodem*)")
    p.add_argument("--rpc", help="JSON-RPC URL")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("addr", help="print the Zero's address and balance")
    s = sub.add_parser("send", help="build, sign on the Zero, broadcast")
    s.add_argument("--to", required=True)
    s.add_argument("--sig", help="function signature for cast calldata, e.g. 'stake(uint256)'")
    s.add_argument("--data", help="raw calldata hex, instead of --sig")
    s.add_argument("--value", default="0", help="ETH to send (default 0)")
    s.add_argument("--no-broadcast", action="store_true")
    s.add_argument("args", nargs="*", help="arguments for --sig")
    args = p.parse_args()
    url = args.rpc or os.environ.get("RPC_URL") or PUBLIC_SEPOLIA_RPC

    if args.cmd == "addr":
        addr = zero_address(find_port(args.port))
        bal = int(rpc(url, "eth_getBalance", addr, "latest"), 16)
        print(f"{addr}   {Decimal(bal) / 10**18} ETH")
    else:
        cmd_send(args, url)


if __name__ == "__main__":
    main()
