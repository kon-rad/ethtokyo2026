# Pi Zero Offline Signer: Setup Guide
### Turn the Pi Zero into an air-gapped wallet that signs AI City transactions over one USB cable

**Written:** 2026-09-27
**Goal:** A Pi Zero that holds an Ethereum key, never touches a network after setup, and signs transactions the Mac builds and broadcasts. For example: staking into a residency, approving USDC, or host actions.
**Scope:** Sepolia only by default. This is a separate device role from the door seat key in [`pi-zero-seat-key-guide.md`](pi-zero-seat-key-guide.md), which only signs access challenges. Both use `/dev/ttyGS0`, so run one service at a time.

---

## TL;DR — the five things that matter

1. **The Mac builds and broadcasts; the Zero only signs.** `cold-sign.py` on the Mac gets the nonce, fees and gas from the RPC and sends the unsigned transaction over USB serial. `zero-tx-signer.py` on the Zero checks it against a policy, signs it, and sends back the raw transaction. The key never leaves the SD card.
2. **Install while online, generate the key only after going offline.** The Zero needs Wi-Fi once, to install `eth-account`. Then Wi-Fi and Bluetooth are switched off at the firmware level (`dtoverlay=disable-wifi`), and the key is created on the first offline boot. **Generating the key on the Mac, as the older seat-key guide does, defeats the air gap.**
3. **You need a data micro-USB cable in the port labelled `USB`, not `PWR`.** That one cable powers the Zero and carries the serial link. The inventory already flagged one of the micro-USB cables as possibly power-only. If `/dev/cu.usbmodem*` never appears on the Mac, suspect the cable first. **This is the step most likely to stall you.**
4. **The Zero enforces a policy the Mac can't change:** Sepolia only (chain 11155111), at most 0.05 ETH value and 0.02 ETH max fee per transaction. To change it you edit the service file on the Zero, which needs the SD card in hand.
5. **There's no screen or button on the Zero, so you trust the Mac's display of what you're signing.** The air gap stops the key being stolen. It doesn't stop a compromised Mac from asking the Zero to sign something bad within the policy limits. Before mainnet, add a confirm button on GPIO or a small screen, and back up the mnemonic on paper.

---

## 0. What you need

| Item | Notes |
|---|---|
| Pi Zero (any model) + its SD card | Already flashed with Raspberry Pi OS |
| Data micro-USB cable to the Mac | Plugs into the Zero's inner port, labelled **USB** |
| Wi-Fi, one time | For `apt` and `pip` during setup |
| On the Mac | `uv` and Foundry's `cast` (both already installed) |

Files in the repo:

| File | Runs on | Does |
|---|---|---|
| `web/hardware/pi-zero/zero-tx-signer.py` | Zero | Key storage, policy, signing daemon on `/dev/ttyGS0` |
| `web/hardware/pi-zero/zero-tx-signer.service` | Zero | systemd unit that starts it at boot |
| `web/hardware/pi-zero/cold-sign.py` | Mac | Builds the transaction, talks to the Zero, broadcasts |

---

## 1. Get a shell on the Zero (online, one time)

The SD card needs Wi-Fi and SSH configured. The inventory says this Zero boots to a desktop, but not whether SSH is on. The quickest reliable path is to re-flash:

1. Raspberry Pi Imager → **Device:** your Zero model → **OS:** Raspberry Pi OS **Lite** (32-bit for Zero / Zero W, 64-bit fine for Zero 2 W. Imager filters this for you).
2. In the customisation screen, set hostname `zero-signer`, a username and password, your Wi-Fi, and **enable SSH** (password auth is fine; it gets turned off later).
3. Write, put the card in the Zero, power it from any USB supply, wait ~2 minutes (a Zero 1 is slow).

From the Mac:

```bash
ssh <user>@zero-signer.local
cat /proc/device-tree/model; echo      # e.g. "Raspberry Pi Zero W Rev 1.1"
```

If the model says **Zero** without **W**, it has no Wi-Fi. Skip to [Troubleshooting](#7-troubleshooting) → "Zero without Wi-Fi".

---

## 2. Install the signer (still online)

On the Zero:

```bash
sudo apt update
sudo apt install -y python3-venv
sudo mkdir -p /opt/zero-signer
sudo python3 -m venv /opt/zero-signer/venv
# Raspberry Pi OS points pip at piwheels, which has prebuilt armv6/armv7 wheels.
# --only-binary stops pip from trying to compile pydantic-core (Rust) on a Zero.
sudo /opt/zero-signer/venv/bin/pip install --only-binary=:all: eth-account pyserial
```

This takes 5–15 minutes on a Zero 1. Check it imports:

```bash
/opt/zero-signer/venv/bin/python -c "import eth_account, serial; print('ok')"
```

From the **Mac**, in the repo root, copy the script and unit over:

```bash
scp web/hardware/pi-zero/zero-tx-signer.py web/hardware/pi-zero/zero-tx-signer.service <user>@zero-signer.local:/tmp/
```

Back on the Zero:

```bash
sudo install -m 755 /tmp/zero-tx-signer.py /opt/zero-signer/zero-tx-signer.py
sudo sed "s/REPLACE_USER/$USER/" /tmp/zero-tx-signer.service | sudo tee /etc/systemd/system/zero-tx-signer.service >/dev/null
sudo usermod -aG dialout $USER
sudo systemctl daemon-reload
sudo systemctl enable zero-tx-signer      # enable, do NOT start: starting would create the key while online
```

---

## 3. Turn on USB serial gadget mode

The Zero's `USB` port becomes a serial device for the Mac. It's serial only (`g_serial`), with no network interface. Don't use `g_ether`, which would give the Zero a network link through the Mac.

```bash
# Enable the USB controller in peripheral mode
echo "dtoverlay=dwc2,dr_mode=peripheral" | sudo tee -a /boot/firmware/config.txt
# Load the controller and the serial gadget at boot
printf "dwc2\ng_serial\n" | sudo tee /etc/modules-load.d/zero-signer.conf
```

`/etc/modules-load.d` replaces the `cmdline.txt` edit from the older guide. It does the same thing without risking a broken one-line `cmdline.txt`.

---

## 4. Go offline for good

Still over SSH. This is the last time the Zero is on a network.

```bash
# Kill the radios in firmware. The kernel never sees a Wi-Fi or Bluetooth device.
printf "dtoverlay=disable-wifi\ndtoverlay=disable-bt\n" | sudo tee -a /boot/firmware/config.txt
# Forget the Wi-Fi network and turn off SSH
nmcli -t -f NAME,TYPE connection show | grep wireless        # note the name
sudo nmcli connection delete "<that name>"
sudo systemctl disable ssh
tail -5 /boot/firmware/config.txt                              # confirm the three dtoverlay lines
sudo poweroff
```

After this the only way into the Zero is its serial protocol, or the SD card in a reader. If you ever need Wi-Fi back, remove the two `disable-` lines from `config.txt` on the Mac. Treat that Zero as no longer air-gapped, and move funds off its key first.

---

## 5. First offline boot: create the key

1. Unplug the power supply. Connect the **data** cable from the Mac to the Zero's **USB** port. Nothing goes in `PWR`.
2. Wait ~60–90 seconds. The service starts, generates a BIP-39 mnemonic, writes it to `/var/lib/zero-signer/mnemonic` (mode 0600), and waits on `/dev/ttyGS0`.
3. On the Mac:

```bash
ls /dev/cu.usbmodem*                                   # one device should appear
cd web/hardware/pi-zero
uv run cold-sign.py addr
# 0xAbC…123   0 ETH
```

That address is the Zero's wallet. It uses the standard path `m/44'/60'/0'/0/0`, so the mnemonic would restore into MetaMask too.

---

## 6. Sign a transaction

**Fund the address** with Sepolia ETH from MetaMask or a faucet, around 0.02 ETH. For residency actions, also mint mock USDC. The Sepolia mock has a public `mint`, which you can call from any funded wallet:

```bash
cast send 0x0abd146eb01d8b923c2162489e006b7b01c77a57 'mint(address,uint256)' <zero address> 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com --account <your cast keystore>
```

Or have the Zero mint to itself:

```bash
uv run cold-sign.py send --to 0x0abd146eb01d8b923c2162489e006b7b01c77a57 --sig 'mint(address,uint256)' <zero address> 1000000000
```

**A plain ETH transfer** (the first test):

```bash
uv run cold-sign.py send --to 0xYourMetaMaskAddress --value 0.001
```

It prints `from / to / call / value / max fee` and asks `y/N`. Then the Zero signs, prints what it decoded, and the Mac broadcasts and waits for the receipt with an Etherscan link.

**Stake into the residency you created.** The host has to approve the Zero's address first, on `/r/[address]/manage`, at price `P` in USDC's 6-decimal units:

```bash
# 1. Let the residency pull USDC from the Zero
uv run cold-sign.py send --to 0x0abd146eb01d8b923c2162489e006b7b01c77a57 --sig 'approve(address,uint256)' <residency> <P>
# 2. Stake at the exact price the host approved (reverts with PriceChanged otherwise)
uv run cold-sign.py send --to <residency> --sig 'stake(uint256)' <P>
```

The Zero decodes Residency, ResidencyFactory and ERC-20 calls by name, such as `Residency.stake(expectedPrice) args=[250000000]`. Anything else still signs, as `unknown call, selector 0x…`, if it's within policy.

Useful flags: `--no-broadcast` signs and prints the raw transaction without sending it. `--rpc URL` or `$RPC_URL` picks the RPC (default: publicnode Sepolia). `--port /dev/cu.usbmodemXXXX` is needed if more than one modem device is plugged in.

The app doesn't know about Zero-signed transactions until it reads them from the chain. Refresh the residency page after the receipt, since the database follows the chain.

### Protocol

One line each way, 115200 baud:

| Mac sends | Zero replies |
|---|---|
| `PING` | `PONG` |
| `ADDR` | `ADDR:0x…` |
| `SIGN:{chainId, nonce, to, value, data, gas, maxFeePerGas, maxPriorityFeePerGas}` | `SIGNED:{raw, hash, from, summary}` or `ERR:<reason>` |

There is no command that returns the mnemonic or private key.

### Policy (on the Zero)

Set in `/etc/systemd/system/zero-tx-signer.service` as `Environment=` lines:

| Variable | Default | Meaning |
|---|---|---|
| `ZERO_CHAIN_IDS` | `11155111` | Comma-separated allowed chain ids. Mainnet (1) only with Konrad's explicit go-ahead |
| `ZERO_MAX_VALUE_WEI` | `50000000000000000` (0.05 ETH) | Max ETH value per transaction |
| `ZERO_MAX_FEE_WEI` | `20000000000000000` (0.02 ETH) | Max `gas × maxFeePerGas` |

Contract creation (no `to`) is refused.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No `/dev/cu.usbmodem*` on the Mac | Power-only cable, or plugged into `PWR`. Try another cable in the `USB` port. Check `config.txt` has `dtoverlay=dwc2,dr_mode=peripheral` (SD card in the Mac: `/Volumes/bootfs/config.txt`) |
| `no reply from the Zero` | Service not running or still booting. Wait 90 s after plugging in. With the SD card in the Mac you can't read the ext4 log, so the fastest check is a monitor + keyboard: `journalctl -u zero-tx-signer` |
| `Zero refused: … not allowed` / `over cap` | Policy did its job. Change the service file if the transaction is legitimate |
| `pip` tries to build `pydantic-core` or `ckzg` | piwheels hasn't built the newest version for your Python yet. `--only-binary=:all:` makes pip pick an older release that has a wheel. If it still fails: `pip install --only-binary=:all: "eth-account<0.14"` |
| `nonce too low` on broadcast | A previous transaction from the Zero is still pending, or was sent twice. Wait for it, then re-run |
| Zero without Wi-Fi (plain Zero) | Install offline: on the Mac, `pip download --only-binary=:all: --platform linux_armv6l --python-version 3.11 --index-url https://www.piwheels.org/simple --extra-index-url https://pypi.org/simple -d wheels eth-account pyserial` (use the Zero's Python version). Copy `wheels/` to the boot partition, then `pip install --no-index --find-links /boot/firmware/wheels eth-account pyserial` at a monitor + keyboard. Not tested |

### Backup

For Sepolia, the SD card is the backup. If you lose it you lose test ETH, and nothing else. Before any real funds, back up the mnemonic on paper. Plug a monitor and keyboard into the Zero (still offline), run `sudo cat /var/lib/zero-signer/mnemonic`, and write it down. Never read it over the serial link, and never copy it onto the Mac.

---

## What's confirmed vs. inferred

**Confirmed (2026-09-27, on the Mac):** the full flow ran end to end on anvil through a virtual serial pair: `addr`, a 0.01 ETH transfer signed by `zero-tx-signer.py`, broadcast and mined, a `stake(uint256)` decoded by name with `--no-broadcast`, and a 0.5 ETH transfer refused by the value cap. The key file was created with mode 0600. `eth-account` 0.14.0 on Python 3.11. piwheels lists armv6l and armv7l wheels for `pydantic-core`, `ckzg`, `bitarray` and `pycryptodome` for cp311 and cp313.

**Not yet tested on the actual Zero:** the gadget setup (`dwc2` + `g_serial` via `modules-load.d`), the systemd unit's `dev-ttyGS0.device` ordering, the `disable-wifi` overlay on your model, and install time on a Zero 1.

**Open questions**

- Which Zero model this is (Zero, W or 2 W). This decides the 32/64-bit image and whether §1 works as written.
- Whether any of the micro-USB cables in the inventory carries data.
- A GPIO confirm button (or a small screen) so the Zero asks for a physical press before signing. Needed before mainnet.
- Whether the seat-key signer and this signer should share one Zero via `g_serial n_ports=2` (`/dev/ttyGS0` + `/dev/ttyGS1`).
