# AI City — Technical Architecture

### Smart contracts, web app, identity, data model and deployment

---

## 1. Stack overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (client)                             │
│  RainbowKit + wagmi + viem │ React Query │ Next.js App Router       │
│  SIWE session cookie │ World IDKit widget │ Tailwind CSS             │
└───────────────┬─────────────────────────────────────────┬───────────┘
                │ HTTP + JSON API                          │ RPC (read)
┌───────────────▼─────────────────────────────────────────▼───────────┐
│                        Next.js server                               │
│  API routes │ Server-only lib │ postgres driver │ jose (JWT)         │
│  @worldcoin/idkit-core/signing │ viem public client                  │
└───────────────┬─────────────────────────────────────────┬───────────┘
                │ SQL                                      │ eth_call
┌───────────────▼──────────┐          ┌────────────────────▼──────────┐
│      Postgres (Neon)     │          │    Ethereum mainnet / anvil   │
│  users │ profiles │      │          │  ResidencyFactory             │
│  cities │ core_team │    │          │  Residency (one per stay)     │
│  series │ proposals │    │          │  USDC (real or mock)          │
│  residencies │ apps │   │          │                              │
│  receipts                 │          │                              │
└──────────────────────────┘          └───────────────────────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + Tailwind | One deployable on Vercel; API routes are the backend |
| Wallets | RainbowKit + wagmi v2 + viem | MetaMask, Rainbow, Ronin Wallet and WalletConnect out of the box |
| Sign-in | SIWE (`viem/siwe`), session in HTTP-only signed cookie (`jose`) | Every write API knows which wallet is calling |
| Humanity | `@worldcoin/idkit` 4.x widget + server-side RP verification | Current World SDK; one nullifier per human |
| Database | Postgres (`postgres` driver, plain SQL) | Neon in production, local Postgres in dev |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin | One factory + one contract per residency |
| Chain reads | viem public client; multicall for listing status | No indexer needed at this scale |

---

## 2. Smart contracts

### 2.1 ResidencyFactory

The singleton factory. Deployed once per chain. Owns nothing, holds no money.

| Function | Description |
|---|---|
| `createResidency(ResidencyParams p) → address` | Deploys a new `Residency` contract. Emits `ResidencyCreated(residency, host, metadataHash)`. The host is `msg.sender`. |

`ResidencyParams`: `metadataHash` (bytes32), `startTime`, `endTime`, `deadline` (uint32), `minSeats`, `maxSeats` (uint32).

### 2.2 Residency

One contract per residency. Holds USDC. Immutable parameters set at construction.

**Immutable state:** `host`, `usdc`, `metadataHash`, `startTime`, `endTime`, `deadline`, `minSeats`, `maxSeats`.

**Constructor checks:** `endTime - startTime >= 7 days`, `deadline <= startTime`, `deadline > now`, `1 <= minSeats <= maxSeats <= 500`.

| Function | Who | Rule |
|---|---|---|
| `approve(member, bedId, price)` | host | Before deadline, not cancelled. Member hasn't staked. Bed not held. Re-approving moves to new bed. |
| `revoke(member)` | host | Only if member hasn't staked. Frees the bed. |
| `stake()` | approved member | Before deadline, not cancelled, `seatCount < maxSeats`. Transfers exactly the approved price. |
| `cancel()` | host | Before deadline. Everyone can claim a full refund. |
| `withdraw(amount, receiptHash, note)` | host | Status Active. `amount <= balance`. |
| `close()` | host (while Active); anyone (after `endTime`) | Snapshots balance for pro-rata leftovers. |
| `claim()` | staker | Failed/cancelled → full stake. Closed → pro-rata share. Once per address. |

**Status machine:** `Open` (before deadline) → `Active` (deadline passed, seats >= min) or `Failed` (deadline passed, seats < min, or cancelled). `Active` → `Closed` via `close()`.

**Safety:** OpenZeppelin `SafeERC20` and `ReentrancyGuard`. Checks-effects-interactions. No proxy, no external calls except USDC transfer. Anyone can close after `endTime`.

### 2.3 Tests (Foundry)

25 tests covering: happy path, minimum-missed refunds, cancellation refunds, max seats, bed double-booking, revoke-after-stake rejection, access control, pro-rata leftovers with mixed prices, anyone-can-close after end, fuzz invariant (USDC held >= everything owed), mainnet-fork test against real USDC.

---

## 3. Data model

### 3.1 Tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Wallet + verification status | `address` PK, `nullifier` (UNIQUE, one wallet per human), `verified_at`, `adult_attested_at` |
| `profiles` | Public directory entry | `address` PK FK, `name`, `bio`, `links` JSONB, `photo` BYTEA, `listed` (opt-out) |
| `cities` | Pop-up city (offchain) | `id` PK, `slug` UNIQUE, `name`, `location`, `mission`, `description`, `start_time`, `end_time`, `founder` |
| `city_core_team` | Who runs a city | `(city_id, address)` PK, `role` (founder/core) |
| `residency_series` | Recurring residency thread | `id` PK, `slug` UNIQUE, `name`, `description`, `owner` |
| `residency_proposals` | Proposal before deploy | `id` PK, `city_id`, `series_id`, `proposer`, `metadata_json`, `metadata_hash`, dates, seats, `status` (proposed/approved/rejected/deployed) |
| `residencies` | Deployed onchain contract | `address` PK, `host`, `metadata_json`, `metadata_hash`, dates, seats, `city_id`, `series_id`, `proposal_id`, `hidden`, `hidden_note` |
| `applications` | Guest applications | `id` PK, `residency` FK, `applicant`, `name`, `bio`, `status` (pending/approved/denied), `bed_id`, `price_units` |
| `receipts` | Withdrawal proof files | `id` PK, `residency` FK, `tx_hash`, `receipt_hash` (sha256), `filename`, `mime`, `data` BYTEA |

### 3.2 Residency metadata JSON (canonical, hashed onchain)

```json
{
  "version": 2,
  "cityId": "edge-city-goa",
  "seriesId": "builders-house",
  "proposalId": 7,
  "name": "Builders' House Goa #1",
  "location": "Anjuna, Goa, India",
  "propertyUrl": "https://airbnb.com/...",
  "mission": "Three weeks to ship something real.",
  "description": "A hacker house near the beach...",
  "organizers": [
    { "name": "Konrad Gnat", "bio": "Builder", "link": "https://x.com/konradgnat" }
  ],
  "rooms": [
    {
      "name": "Garden dorm",
      "type": "shared",
      "beds": [
        { "id": 1, "label": "Bunk 1", "price": "650" },
        { "id": 2, "label": "Bunk 2", "price": "650" }
      ]
    }
  ]
}
```

Prices are in USDC (6 decimal places, stored as strings in the JSON to avoid floating point). The `cityId`, `seriesId` and `proposalId` are pinned at proposal time, so the core team approves exactly what gets deployed.

---

## 4. API routes

### 4.1 Auth

| Route | Auth | Description |
|---|---|---|
| `GET /api/auth/nonce` | — | Returns a nonce for SIWE |
| `POST /api/auth/verify` | nonce cookie | Verifies SIWE signature, issues session cookie |
| `POST /api/auth/logout` | session | Clears session cookie |
| `GET /api/me` | session | Returns wallet address, verification status, profile name |

### 4.2 World ID

| Route | Auth | Description |
|---|---|---|
| `POST /api/world/rp-context` | session | Signs the IDKit request with the RP signing key |
| `POST /api/world/verify` | session | Forwards proof to World developer API, stores nullifier and 18+ attestation |
| `POST /api/world/dev-verify` | session, `ALLOW_DEV_VERIFY` | Local dev path that skips World verification |

### 4.3 Cities

| Route | Auth | Description |
|---|---|---|
| `GET /api/cities` | — | Paginated listing of active (not ended) cities |
| `POST /api/cities` | verified | Launch a new city. Creates the city row + founder in core_team. Returns slug. |
| `GET /api/cities/[slug]` | — | City detail with core team and signed-in user's role |
| `PATCH /api/cities/[slug]` | core team | Edit city. Dates can't shrink past approved proposals. |
| `POST /api/cities/[slug]/team` | core team | Add a core team member |
| `DELETE /api/cities/[slug]/team` | founder only | Remove a core team member (not the founder) |

### 4.4 Proposals

| Route | Auth | Description |
|---|---|---|
| `GET /api/cities/[slug]/proposals` | core team | All proposals for a city |
| `POST /api/cities/[slug]/proposals` | verified | Propose a residency. Creates or picks a series, builds canonical metadata, inserts proposal. |
| `GET /api/proposals/[id]` | proposer or core team | Full proposal detail |
| `POST /api/proposals/[id]` | core team | Approve or reject a proposal |

### 4.5 Residencies

| Route | Auth | Description |
|---|---|---|
| `GET /api/residencies` | — | Paginated listing with onchain status. Filters: `city`, `series`, `all`. |
| `GET /api/residencies/[address]` | — | Single residency with city/series names |
| `POST /api/residencies` | verified proposer | Record a deployed residency. Reads the tx receipt, decodes `ResidencyCreated`, verifies metadata hash, dates and seats match the approved proposal. |
| `POST /api/residencies/[address]/visibility` | city core team | Hide a residency with a public note (doesn't touch the contract) |

### 4.6 Applications, receipts, profiles, directory, series

See the full route table in `architecture-plan.md` or `README.md`.

---

## 5. Session and auth flow

```
Browser                          Server
  │                                │
  │  1. Connect wallet (RainbowKit)│
  │                                │
  │  2. GET /api/auth/nonce        │
  │   ◄────── nonce + cookie ──────│  (nonce JWT, 10 min expiry)
  │                                │
  │  3. Sign SIWE message          │
  │     { domain, address, nonce } │
  │                                │
  │  4. POST /api/auth/verify      │
  │     { message, signature }     │
  │   ◄── session cookie ──────────│  (session JWT, 7 day expiry)
  │                                │
  │  5. Every API call sends cookie│
```

The session JWT contains the wallet address. The server reads it, looks up verification status and profile name from the database on every request.

---

## 6. Deploy flow (residency lifecycle)

```
Proposer                          API                              Chain
  │                                │                                │
  │  1. POST /api/cities/.../props │                                │
  │  (form data)                   │                                │
  │                                ├─ validate dates against city   │
  │                                ├─ create/pick series            │
  │                                ├─ build canonical metadata JSON │
  │                                ├─ INSERT proposal (status=proposed)
  │   ◄── { proposalId: 7 } ──────┤                                │
  │                                │                                │
  │  [Core team reviews]           │                                │
  │                                │                                │
  │  2. POST /api/proposals/7      │                                │
  │  { decision: "approve" }       │                                │
  │                                ├─ UPDATE status = 'approved'    │
  │                                │                                │
  │  3. wallet.writeContract       │                                │
  │     createResidency(params)    ├───────────────────────────────►│
  │                                │                                ├─ deploy Residency
  │                                │                                ├─ emit ResidencyCreated
  │   ◄── txHash ─────────────────┤◄───────────────────────────────┤
  │                                │                                │
  │  4. POST /api/residencies      │                                │
  │  { txHash, proposalId: 7 }    │                                │
  │                                ├─ waitForTransactionReceipt     │
  │                                ├─ parse ResidencyCreated event  │
  │                                ├─ verify hash, dates, seats     │
  │                                ├─ INSERT residencies row        │
  │                                ├─ UPDATE proposal = 'deployed'  │
  │   ◄── { address: 0x... } ─────┤                                │
```

---

## 7. Security model

- **Private keys never touch the server.** SIWE proofs are verified; the server only stores a session cookie.
- **Receipt files are sha256'd onchain.** The server rejects uploads whose hash doesn't match the `Withdrawn` event.
- **Receipts are served only to the host and staked members.** The API checks `getMember(addr).staked` before serving.
- **Applications are authenticated by session.** The server reads the session cookie to know who is calling.
- **Nullifier uniqueness.** The `UNIQUE` constraint on `users.nullifier` enforces one wallet per human even if the wallet changes.
- **Cross-residency isolation.** Each `Residency` contract holds its own USDC. The factory deploys new contracts; it doesn't hold a balance.

---

## 8. Deployment

### Local development

```
anvil &
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0x...
createdb ai_city && DATABASE_URL=postgres://localhost/ai_city node web/scripts/migrate.mjs
cd web && pnpm dev --port 3100
```

### Mainnet

1. Deploy factory via hardware wallet: `forge script script/Deploy.s.sol --rpc-url mainnet --ledger --broadcast --verify`
2. Set up Neon Postgres, run `node web/scripts/migrate.mjs`
3. Deploy web app to Vercel with env vars from `.env.example`
4. Smoke test with a 1 USDC residency

### Sepolia staging

```
forge script script/DeploySepolia.s.sol --tc DeploySepolia --rpc-url <sepolia-rpc> --broadcast --verify
```

Set `NEXT_PUBLIC_CHAIN_ID=11155111` for the web app to point at Sepolia.

---

## Sources

- `Projects/ai-city/README.md`
- `Projects/ai-city/contracts/src/Residency.sol`
- `Projects/ai-city/contracts/src/ResidencyFactory.sol`
- `Projects/ai-city/web/db/schema.sql`
- `Projects/ai-city/web/lib/config.ts`
- `Projects/ai-city/web/components/providers.tsx`