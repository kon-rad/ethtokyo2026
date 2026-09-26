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
| | Stake | — | `stake()` (USDC approve first) |
| | Deadline | — | `status()` → Active (≥ min seats) or Failed (refunds) |
| | Withdraw | Receipt file stored, sha256 checked against the event | `withdraw(amount, receiptHash, note)` |
| | Close / claim | — | `close()` → pro-rata leftovers; `claim()` |

**Agents:** people's agents can do everything the UI does. Point them at `/skill.md` ([`web/public/skill.md`](web/public/skill.md)), which indexes per-task skills in `web/public/skills/`: auth, directory, launch-city, launch-residency, apply-residency, knowledge.

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
node scripts/e2e-local.mjs
```

After changing a contract: `forge build && node web/scripts/gen-abi.mjs`.

## Deploy to mainnet

1. World Developer Portal: create the app, note `app_id`, `rp_id` and the signing key; create action `ai-city-verify-human`.
2. `cd contracts && forge script script/Deploy.s.sol --tc Deploy --rpc-url mainnet --ledger --broadcast --verify` (hardware wallet; `ETHERSCAN_API_KEY` set). Note the factory address and block.
3. Neon Postgres → `node web/scripts/migrate.mjs`.
4. Vercel: root `web/`, env vars from `web/.env.example` (`NEXT_PUBLIC_CHAIN_ID=1`, `NEXT_PUBLIC_WORLD_ENV=production`, no `ALLOW_DEV_VERIFY`).
5. Smoke test with a 1 USDC city before announcing.

## Pages

| Path | Description |
|---|---|
| `/` | Home: mission, residencies, cities, people |
| `/docs` | Self-hosted documentation: concepts, guides, architecture, extropian vision |
| `/devlog` | Build journal: what was shipped, what broke, what comes next |
| `/blog` | Blog index |
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
| `/people` | Public directory |
| `/people/[address]` | Person's profile and participation |
| `/me` | Edit your own profile |

## Team

Konrad Gnat — [@konradgnat](https://x.com/konradgnat)