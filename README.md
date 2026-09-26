# AI City

Luma for pop-up cities. Anyone can launch a city (a place and a time window, offchain). Inside each city, verified humans propose residencies with dates, rooms and per-bed prices. The city's core team approves each proposal, then the proposer deploys a Residency contract onchain. Guests apply, hosts approve each guest for a bed, and guests stake USDC into the residency's own contract. If the minimum isn't reached by the deadline, everyone is refunded. If it is, the host withdraws against uploaded receipts, and unspent funds return pro-rata at close.

**Unaudited. Only deposit what you can afford to lose.**

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

**Agents:** people's agents can do everything the UI does, and the human signs every wallet action. The human creates an API key at `/me` → *Agent access*; the agent sends it as `Authorization: Bearer aic_…` to the HTTP API or to the **MCP server at `/api/mcp`** (40 tools, each running the matching route in-process). `POST /api/tx` turns any onchain action into exact calldata for the human to sign. Point agents at `/skill.md` ([`web/public/skill.md`](web/public/skill.md)), which indexes per-task skills in `web/public/skills/`: auth, mcp, transactions, directory, launch-city, launch-residency, apply-residency, knowledge. Plan: [`docs/agent-access-plan.md`](docs/agent-access-plan.md).

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

## Pages

| Path | Description |
|---|---|
| `/` | Home: mission, residencies, cities, people |
| `/docs` | Self-hosted documentation: concepts, guides, architecture, extropian vision |
| `/devlog` | Build journal: what was shipped, what broke, what comes next |
| `/blog` | Blog index |
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
| `/me` | Edit your own profile; create and revoke agent API keys |

## Agent endpoints

| Path | Description |
|---|---|
| `/skill.md`, `/skills/*.md` | Agent skill files |
| `POST /api/mcp` | MCP server (Streamable HTTP, stateless). Bearer API key. |
| `POST /api/tx` | Prepare an onchain action as calldata for the human to sign |
| `GET` / `POST /api/keys`, `DELETE /api/keys/[id]` | Manage API keys (browser session only) |
| `GET /api/residencies/[addr]/door/challenge` | House door: a one-time challenge for the guest's Pi Zero seat key to sign |
| `GET` / `POST /api/residencies/[addr]/door/checkins` | Who's in the house (public, for the board) / record a signed check-in or check-out from the door |

## Team

Konrad Gnat — [@konradgnat](https://x.com/konradgnat)