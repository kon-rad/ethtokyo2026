# AI City

Luma for pop-up cities. Anyone can launch a city (a place and a time window, offchain). Inside each city, verified humans propose residencies with dates, rooms and per-bed prices. The city's core team approves each proposal, then the proposer deploys a Residency contract onchain. Guests apply, hosts approve each guest for a bed, and guests stake USDC into the residency's own contract. If the minimum isn't reached by the deadline, everyone is refunded. If it is, the host withdraws against uploaded receipts, and unspent funds return pro-rata at close.

**Unaudited. Only deposit what you can afford to lose.**

Live on Ethereum mainnet at [aicity.cyou](https://aicity.cyou).

## Demo video

[![AI City demo video](https://img.youtube.com/vi/LqMwDiv1P_w/maxresdefault.jpg)](https://www.youtube.com/watch?v=LqMwDiv1P_w)

Watch on YouTube: https://www.youtube.com/watch?v=LqMwDiv1P_w

## Features

### 1. Launch a pop-up city

A pop-up city is a place and a time window: name, location, dates, mission, description. Any verified human (World ID, one person one account) can launch one at `/launch`. The city lives offchain in Postgres and holds no money. Whoever launches it is its **founder** and the first member of its **core team**, and can add more members. The core team edits the city and decides which residencies run in it.

### 2. Launch a residency, approved by the city's founders

A residency is a house inside a city: dates, rooms, beds, a per-bed price in USDC, a minimum and maximum number of guests, and an application deadline.

1. **Propose.** Any verified human proposes a residency inside a city. The proposal is saved as canonical JSON and its hash is pinned.
2. **City approves or rejects.** The city's founder and core team review each proposal and approve or reject it. Nothing goes onchain until they approve.
3. **Deploy.** Once approved, the proposer (now the **host**) deploys the residency's own `Residency` contract through `ResidencyFactory`. Each residency gets its own contract address and its own USDC balance.

### 3. Guests apply, the host approves or denies, guests pay

1. **Apply.** A guest applies with a name, bio, links and a preferred bed.
2. **Host approves or denies.** The residency's founder (its host) reviews every application and approves the guest for a specific bed at a specific price (`approve(member, bedId, price)`) or leaves them out. Only approved guests can pay.
3. **Stake.** The approved guest stakes the exact bed price in USDC into the residency's contract. No one else holds the money, including AI City.

### 4. The host withdraws only once the minimum is met

The contract enforces the rule, not the app:

| At the deadline | Status | What happens |
|---|---|---|
| Fewer than `minSeats` guests have paid | **Failed** | Every guest claims a full refund. The host can't touch the money. |
| At least `minSeats` guests have paid | **Active** | The host can withdraw, one withdrawal at a time, each tied to an uploaded receipt (its sha256 is recorded onchain with a note). |
| Residency ends and is closed | **Closed** | Whatever the host didn't spend is returned to guests pro-rata. |

The host can also cancel before the deadline, which refunds everyone.

### 5. Air-gapped Pi Zero seat key opens the house door

A proof of concept for an **agent-first pop-up city**, where a house checks who you are by a cryptographic signature instead of a front desk.

- **The key is a Pi Zero with no network.** It has no Wi-Fi and has never been online, not even during install (every package goes onto the SD card from a Mac as offline wheels). It generates its Ethereum wallet on the device and writes only the public address back to the card.
- **The same key pays and opens the door.** The wallet that staked for your bed is the wallet that unlocks the house.
- **Plug it in and the door opens.** The Zero plugs into the house's Raspberry Pi 4 by its USB data port, powers up from it, and appears as a USB serial device. The Pi 4 fetches a one-time challenge from the app, sends it to the Zero, and the Zero signs it. The Pi 4 recovers the address from the signature and checks the door rule. If it passes, the servo latch opens for 30 seconds and locks again.
- **Door rules** (`DOOR_RULE`): `pair` (the first key plugged in is enrolled; for the bench test), `staked` (the address is the host or has staked in this residency, read from the contract), `active` (staked, the residency is Active, and today falls within its dates).
- **Every check-in is recorded.** The Pi 4 posts the signed challenge to the app, which verifies it (HMAC-bound, single use, 5-minute window) and toggles that wallet in or out of the house.

#### What happens when you plug the Zero into the Pi 4

The Zero is a wallet with no network: one private key, no Wi-Fi, no screen, and a USB cable as its only way in or out. The Pi 4 is on Wi-Fi and runs two things: the kiosk showing the board, and the door service (`aicity-door`, [`pi4-door.py`](web/hardware/pi4/pi4-door.py)).

| # | Where | What happens |
|---|---|---|
| 1 | Both | The Pi 4's USB port powers the Zero, which boots from cold (it has no battery). |
| 2 | Zero → Pi 4 | Partway through boot the Zero loads `g_serial`, and its USB port becomes a plain serial line. The Pi 4 sees `/dev/serial/by-id/…Gadget_Serial…`. It's a text line, not a network link, so the Zero can't reach the internet through it. |
| 3 | Pi 4 ↔ Zero | The door sends `PING` every 2 s. On the Zero, `zero-tx-signer` ([`zero-tx-signer.py`](web/hardware/pi-zero/zero-tx-signer.py)) loads its key from `/var/lib/zero-signer/` (owner-only) and answers `PONG`. About a minute from plug-in on a Zero 1. |
| 4 | Pi 4 → app | The door fetches a one-time challenge: `GET /api/residencies/[addr]/door/challenge`. 32 bytes: issue time, 8 random bytes and an HMAC of both keyed from the server's secret, so the server knows its own challenges without storing them. |
| 5 | Pi 4 ↔ Zero | The door sends `DOOR:<residency>:<challenge>`. The Zero checks it against a strict pattern, signs the fixed text `AI City door access` / `residency: …` / `challenge: …` as an EIP-191 personal message, and replies `DOOR_SIG:0x…`. The key never leaves the Zero, and this command can't be used to sign a transaction or a login. |
| 6 | Pi 4 | The door recovers the signer's address from the signature and checks `DOOR_RULE`. `pair` compares it with the enrolled address in `/var/lib/aicity-door/paired-address`. `staked` and `active` read the residency contract instead. |
| 7 | Pi 4 | If the rule passes, the servo latch opens: hardware PWM on GPIO 12 (pin 32), servo powered from the breadboard, grounds shared. |
| 8 | Pi 4 → app | While the latch is open, the door posts the challenge and signature to `POST /api/residencies/[addr]/door/checkins`. The server checks it without trusting the door: it issued the challenge, the challenge is under 5 minutes old and unused, and the signature recovers to that address. Then it writes a `door_checkins` row that flips the wallet in or out. |
| 9 | Pi 4 | After `DOOR_OPEN_SECONDS` the latch locks. |
| 10 | Kiosk | The board polls `GET …/door/checkins` every 5 s and shows the wallet under **In the house** with its profile name and bed. |
| 11 | Pi 4 | One open per plug-in: the door waits for the serial port to disappear (`key removed`) before it answers the next insertion. |

What the door service logs for one insertion, from the first hardware run on 2026-09-27:

```
09:29:43 key on /dev/serial/by-id/usb-Linux_…_Gadget_Serial_v2.4-if00
09:30:13 key awake after 30.0s on the port (up=58.7 ready=58.7)
09:30:14 OPEN 0x2C0a…f798: paired key is 0x2C0a…f798
09:30:15 checked in: 0x2C0a…f798
09:30:23 locked
```

| | Holds | Can't |
|---|---|---|
| **Pi Zero** | The private key (mnemonic plus a cached derived key) | Reach any network, or sign anything but door messages and in-policy transactions (Sepolia, capped value and fee) |
| **Pi 4** | The door rule, the paired address, the latch | Sign as the guest. It only ever sees signatures |
| **App** | Check-in rows, profile names, the challenge secret | Record a check-in without a fresh signature from that wallet |

Known gaps: the board is public, so anyone with its URL can see who's inside. The door itself isn't authenticated to the app yet, so a guest holding their own key could sign a challenge away from the door.

Setup: [`docs/pi4-door-kiosk-setup.md`](docs/pi4-door-kiosk-setup.md), [`docs/pi-zero-offline-signer-setup.md`](docs/pi-zero-offline-signer-setup.md). Code: `web/hardware/pi-zero/`, `web/hardware/pi4/`.

### 6. House dashboard on the Raspberry Pi 4 screen

The Pi 4 boots straight into a Chromium kiosk on a 3.5" (480×320) screen showing `/r/[address]/board`, the residency's house board:

- **Seats:** how many beds are paid out of the minimum and maximum.
- **Deadline:** a countdown to the application deadline, then the residency's status (Open, Active, Failed, Closed).
- **Treasury:** the USDC held in the residency's contract, read from the chain.
- **In the house:** who's inside right now, from signed check-ins at the door, with each person's name and bed.
- **Activity:** the latest door events and onchain events.
- **Door banner:** full screen while a key is in the door. Amber with a running timer while checking, green "Welcome, door open", red with the reason when denied.

Everything is configured from the SD card's boot partition (`board-url.txt`, `door.env`), so the Pi needs no keyboard.

### 7. AI concierge and knowledge base for every city and residency

- **Each city and each residency has its own knowledge base**: markdown written in the app, or PDF/DOCX uploads whose text is extracted. Files are stored in Postgres and chunked for full-text search. The city founder edits the city's, the host edits the residency's.
- **A residency inherits its city.** A residency's concierge reads the residency's own files **and all of its city's files**, plus the residency's live listing (dates, beds, prices).
- **Each has an AI concierge**: a chat on the city and residency pages that answers from the knowledge base (arrival, house rules, local guide, who's coming) and quotes the file it used.
- **Your agent can use it too, over MCP.** Connect any MCP client to `/api/mcp` with an API key from `/me` and use `list_knowledge`, `read_knowledge_file`, `search_knowledge` and `ask_concierge`; founders and hosts also get `write_knowledge_file`, `upload_knowledge_file` and `delete_knowledge_file`. Documented at `/docs#mcp-tools` and in [`web/public/skills/knowledge.md`](web/public/skills/knowledge.md).

### 8. Link your Argo private AI journal to the concierge

[Argo](https://myargoquest.com) is a private, end-to-end encrypted AI journal. Link it on your AI City profile, and a city's or residency's concierge can **ask your journal specific questions**. You answer or decline each one in Argo, and the concierge uses the approved answers to introduce you to people in that residency and city:

- a new **co-founder**,
- a new **business partner**,
- a new **business opportunity**,
- a **trade** or a **topic to discuss**.

How it works:

1. **Link.** On `/me` → *Argo private journal*, enter your Argo `@username` (Argo → Settings → Username) or the 0x wallet in Argo. Verified humans only. Nothing is shared at link time.
2. **Ask.** In a city's or residency's concierge chat, press **Ask my Argo journal** (or have your agent call `ask_my_argo_journal`). AI City signs an [Argo information request](https://myargoquest.com/agents) with the concierge's own key (`ARGO_AGENT_PRIVATE_KEY`) and sends four matchmaking questions to `POST https://api.luminalog.com/v1/inbox/requests`: what you're building, who you want to meet, what you can offer, what you'd like to talk about.
3. **You answer in Argo.** The questions land in Argo's **Inbox** (iOS 1.0.2+). Argo drafts answers from your journal on your phone; you edit, decline or send. Only what you send leaves Argo. The journal itself never does.
4. **Delivery.** Argo posts the answers to `/api/argo/webhook`, signed with its server key. AI City checks the signature against the signer it pins from `GET /v1/inbox/signer` and stores them (`argo_requests`).
5. **Match.** The concierge of that residency (and its city), or that city (and all its residencies), reads approved answers as *member notes*. Ask it "who should I meet?" and it suggests introductions and says why.

**Privacy:** the concierge chat is public, so anyone who asks it can get it to repeat your approved answers. The reason text sent with each request says so. `/me` lists every request and its answers. **Remove from concierge** deletes one, and **Unlink** deletes all of them. Argo allows 3 requests a day from the concierge to one person.

Code: `web/lib/server/argo.ts`, `web/app/api/argo/`, the `ArgoJournal` card in `web/app/me/page.tsx`, `web/components/concierge-panel.tsx`. Test: `node web/scripts/e2e-argo.mjs` (against the real Argo API, with a recipient that doesn't exist, so no inbox is touched).

## How it works

| Layer | Step | Offchain (Next.js + Postgres) | Onchain (Ethereum, USDC) |
|---|---|---|---|
| **City** | Launch | Form → `POST /api/cities` → saved in `cities` table | — |
| | Core team | Founder adds members via `POST /api/cities/[slug]/team` | — |
| | Edit | Core team updates dates/details via `PATCH /api/cities/[slug]` | — |
| **Proposal** | Propose | Form → `POST /api/cities/[slug]/proposals` → validated, canonical JSON built | — |
| | Review | Core team approves/rejects via `POST /api/proposals/[id]` | — |
| **Residency** | Deploy | Proposer calls `POST /api/residencies` after the tx | `ResidencyFactory.createResidency` deploys a `Residency` |
| | Apply | Name, bio, links, preferred bed → `POST /api/residencies/[addr]/apply` | — |
| | Approve | Host records after the tx is mined | `approve(member, bedId, price)` |
| | Stake | — | `stake(price)` (USDC approve first) |
| | Deadline | — | `status()` → Active (≥ min seats) or Failed (refunds) |
| | Withdraw | Receipt file stored, sha256 checked against the event | `withdraw(amount, receiptHash, note)` |
| | Close / claim | — | `close()` → pro-rata leftovers; `claim()` |

**Agents:** people's agents can do everything the UI does, and the human signs every wallet action. The human creates an API key at `/me` → *Agent access*; the agent sends it as `Authorization: Bearer aic_…` to the HTTP API or to the **MCP server at `/api/mcp`** (43 tools, each running the matching route in-process). `POST /api/tx` turns any onchain action into exact calldata for the human to sign. Point agents at `/skill.md` ([`web/public/skill.md`](web/public/skill.md)), which indexes per-task skills in `web/public/skills/`: auth, mcp, transactions, directory, launch-city, launch-residency, apply-residency, knowledge. Plan: [`docs/agent-access-plan.md`](docs/agent-access-plan.md).

**Knowledge bases:** each city and residency has one, stored in Postgres (`knowledge_files`, chunked into `knowledge_chunks` for full-text search). The city founder or residency host writes markdown or uploads PDF/DOCX, whose text is extracted. A residency's concierge also reads its city's files. `web/knowledge/` holds seed files loaded by `scripts/import-knowledge.mjs`.

Architecture and design: [`docs/architecture-plan.md`](docs/architecture-plan.md). Security notes: [`docs/SECURITY.md`](docs/SECURITY.md).

## Repo

```
contracts/   Foundry: src/Residency.sol, src/ResidencyFactory.sol, tests (unit, fuzz, invariant, mainnet fork)
web/         Next.js 16 app: app/ (pages + API routes), lib/, components/, db/schema.sql, scripts/
docs/        architecture plan, security notes, World ID debrief
```

## Run locally

Requires Foundry, Node 22+, pnpm, and Postgres.

```bash
# contracts
cd contracts && forge test
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract Fork   # real USDC

# local chain + contracts
anvil &
forge script script/DeployLocal.s.sol --tc DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# web
cd ../web && pnpm install
createdb ai_city && DATABASE_URL=postgres://localhost/ai_city node scripts/migrate.mjs
cp .env.example .env.local   # fill in; for local use NEXT_PUBLIC_CHAIN_ID=31337 and ALLOW_DEV_VERIFY=1
pnpm dev --port 3100

# seed demo data and run the full e2e test
node scripts/seed-local.mjs
node scripts/import-knowledge.mjs   # knowledge/ seed files → Postgres
node scripts/e2e-local.mjs
node scripts/e2e-agent.mjs          # same lifecycle driven over MCP with API keys
```

After changing a contract: `forge build && node web/scripts/gen-abi.mjs`.

## Deploy the web app (shared droplet)

The live instance runs on Ethereum mainnet on a shared DigitalOcean droplet (PM2 `ai-city-web` on port 3300, nginx in front, local Postgres). It builds on your machine, because the droplet's memory is shared with other apps:

```bash
AICITY_DEPLOY_SERVER=root@<host> AICITY_DEPLOY_SSH_KEY=~/.ssh/<key> web/scripts/deploy-droplet.sh
```

It deploys the committed `HEAD`, keeps the server's own `.env.local`, runs the migration and restarts. One-time server setup is in the script's header.

## Deploy to mainnet

**Deployed 2026-09-27.** `ResidencyFactory` [`0x0Abd146EB01d8b923C2162489E006b7b01C77A57`](https://etherscan.io/address/0x0Abd146EB01d8b923C2162489E006b7b01C77A57) on Ethereum mainnet, block 26064603, real USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. The factory has no owner. Redeploying means a new factory address in the server env.

Steps as run (or to repeat):

1. World Developer Portal: create the app, note `app_id`, `rp_id` and the signing key; create action `ai-city-verify-human`.
2. `cd contracts && forge script script/Deploy.s.sol --tc Deploy --rpc-url mainnet --ledger --broadcast --verify` (hardware wallet; `ETHERSCAN_API_KEY` set). Note the factory address and block.
3. Neon Postgres → `node web/scripts/migrate.mjs`, then `node web/scripts/import-knowledge.mjs`.
4. Vercel: root `web/`, env vars from `web/.env.example` (`NEXT_PUBLIC_CHAIN_ID=1`, `NEXT_PUBLIC_WORLD_ENV=production`, no `ALLOW_DEV_VERIFY`).
5. Smoke test with a 1 USDC city before announcing.

## Demos (screen recordings)

The full walkthrough is the [demo video on YouTube](https://www.youtube.com/watch?v=LqMwDiv1P_w). The raw clips:

| File | What it shows |
|------|---------------|
| `screen-recordings/homepage-launch-popupcity.mov` | Homepage → launch a pop-up city flow |
| `screen-recordings/launch-new-residency-pt1.mov` | Launching a new residency (part 1 — filling in details) |
| `screen-recordings/launch-new-residency-form.mov` | The residency creation form |
| `screen-recordings/launch-new-residency-submit.mov` | Submitting the residency form |
| `screen-recordings/deploy-residency-sign.mov` | Deploying the Residency contract and signing the transaction |
| `screen-recordings/apply-to-residency-and-updateprofile.mov` | Applying to a residency + updating your profile |
| `screen-recordings/hacker-application.mov` | Hacker application flow |

## Pages

| Path | Description |
|---|---|
| `/` | Home: mission, residencies, cities, people |
| `/docs` | Self-hosted documentation: concepts, guides, architecture, extropian vision |
| `/devlog` | Build journal: what was shipped, what broke, what comes next |
| `/blog` | Blog index |
| `/blog/argo-journal-concierge` | Link your Argo private AI journal to the concierge to find co-founders, partners and opportunities |
| `/blog/connect-your-agent` | How to connect your AI agent: API key, MCP setup, example prompts |
| `/blog/infomorph-extropianism` | Infomorphs and Extropianism — the full vision post |
| `/launch` | Launch a pop-up city |
| `/cities` | Browse pop-up cities |
| `/cities/[slug]` | City detail + its residencies + proposals (core team) |
| `/cities/[slug]/manage` | Edit city, manage core team |
| `/cities/[slug]/propose` | Propose a residency in this city |
| `/proposals/[id]` | Proposal detail, review (core team) and deploy (proposer) |
| `/series/[slug]` | Residency series with all its instances |
| `/r/[address]` | Residency detail, apply, pay, treasury |
| `/r/[address]/manage` | Host dashboard: applications, withdraw, lifecycle |
| `/r/[address]/board` | House status board for the Pi's 3.5" screen: seats, deadline, USDC, who's in the house |
| `/people` | Public directory |
| `/people/[address]` | Person's profile and participation |
| `/me` | Edit your own profile; create and revoke agent API keys; link your Argo journal and see its answers |

## Agent endpoints

| Path | Description |
|---|---|
| `/skill.md`, `/skills/*.md` | Agent skill files |
| `POST /api/mcp` | MCP server (Streamable HTTP, stateless). Bearer API key. |
| `POST /api/tx` | Prepare an onchain action as calldata for the human to sign |
| `GET` / `PUT` / `DELETE /api/argo/link` | Your linked Argo journal (`@username` or 0x). Linking needs World ID |
| `GET` / `POST /api/argo/requests`, `DELETE /api/argo/requests/[id]` | Have a concierge ask your Argo journal; list requests and answers; remove one from the concierge |
| `POST /api/argo/webhook` | Argo delivers approved answers here, signed by its pinned server key |
| `GET` / `POST /api/keys`, `DELETE /api/keys/[id]` | Manage API keys (browser session only) |
| `GET /api/residencies/[addr]/door/challenge` | House door: a one-time challenge for the guest's Pi Zero seat key to sign |
| `GET` / `POST /api/residencies/[addr]/door/checkins` | Who's in the house (public, for the board) / record a signed check-in or check-out from the door |

## Team

Konrad Gnat — [@konradgnat](https://x.com/konradgnat)

---

*A Konrad Gnat production. Founder, [Argo](https://myargoquest.com).*
