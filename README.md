# AI City

Luma for pop-up cities. Hosts launch a city with dates, rooms and per-bed prices. Verified humans apply, hosts approve each guest for a bed, and guests stake USDC into the city's own contract. If the minimum isn't reached by the deadline, everyone is refunded. If it is, the host withdraws against uploaded receipts, and unspent funds return pro-rata at close.

**Unaudited. Only deposit what you can afford to lose.**

## How it works

| Step | Offchain (Next.js + Postgres) | Onchain (Ethereum, USDC) |
|---|---|---|
| Sign in | SIWE session cookie | — |
| Verify | World ID Proof of Human (IDKit 4.x), verified server-side; nullifier stored UNIQUE (one wallet per human) + 18+ attestation | — |
| Launch | Form → canonical metadata JSON | `AICityFactory.createCity` deploys a `PopupCity`; metadata keccak256 stored onchain |
| Apply | Name, bio, links, preferred bed | — |
| Approve | Recorded after the tx is mined | `approve(member, bedId, price)` |
| Stake | — | `stake()` (USDC approve first) |
| Deadline | — | `status()` → Active (≥ min seats) or Failed (refunds) |
| Withdraw | Receipt file stored, sha256 checked against the event | `withdraw(amount, receiptHash, note)` |
| Close / claim | — | `close()` → pro-rata leftovers; `claim()` |

Architecture and design: [`docs/architecture-plan.md`](docs/architecture-plan.md). Security notes: [`docs/SECURITY.md`](docs/SECURITY.md).

## Repo

```
contracts/   Foundry: src/PopupCity.sol, src/AICityFactory.sol, tests (unit, fuzz, invariant, mainnet fork)
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
node scripts/e2e-local.mjs   # 37 end-to-end checks against the running stack
```

After changing a contract: `forge build && node web/scripts/gen-abi.mjs`.

## Deploy to mainnet

1. World Developer Portal: create the app, note `app_id`, `rp_id` and the signing key; create action `ai-city-verify-human`.
2. `cd contracts && forge script script/Deploy.s.sol --tc Deploy --rpc-url mainnet --ledger --broadcast --verify` (hardware wallet; `ETHERSCAN_API_KEY` set). Note the factory address and block.
3. Neon Postgres → `node web/scripts/migrate.mjs`.
4. Vercel: root `web/`, env vars from `web/.env.example` (`NEXT_PUBLIC_CHAIN_ID=1`, `NEXT_PUBLIC_WORLD_ENV=production`, no `ALLOW_DEV_VERIFY`).
5. Smoke test with a 1 USDC city before announcing.

## Team

Konrad Gnat — [@konradgnat](https://x.com/konradgnat)
