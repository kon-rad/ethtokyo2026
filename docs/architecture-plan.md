# AI City: Architecture and Design Plan

### Luma for pop-up cities: launch a city, propose residencies, stake seats in USDC, refund if it doesn't fill

**Written:** 2026-09-26 (day two of ETHGlobal Tokyo)
**Updated:** 2026-09-26 (city layer: cities are offchain containers, residencies are onchain contracts)
**Goal:** A simple, Luma-like dapp on Ethereum mainnet, live by Sun 2026-09-27 09:00 JST and used for the Edge City Goa hacker house.
**Scope:** Ethereum mainnet, native USDC. World ID Proof of Human via IDKit 4.x, plus a self-attested 18+ checkbox (World's `minimum_age` Identity Check is in preview; swap it in when World grants access). The host approves each member for a specific bed at a specific price. Decisions confirmed by Konrad on 2026-09-26. Background: [[residency-mvp-mainnet-plan]].

---

## TL;DR — the five things that matter

1. **Two-layer model: cities (offchain) and residencies (onchain).** A pop-up city is a place and a time window, stored in Postgres with no contract. Residencies are proposed inside a city, approved by its core team, then deployed as individual Residency contracts. This decouples city governance from onchain risk.
2. **One contract per residency, deployed by a factory.** Proposing is free (offchain). Deploying is one transaction: `ResidencyFactory.createResidency(...)` deploys a `Residency`. Each residency's USDC sits in its own contract, so a bug or a bad host in one can't touch another's money.
3. **Only money and seats go onchain. Everything descriptive lives in Postgres, pinned by a hash.** The name, description, rooms, organizers and applications are rows in a database. The contract stores `keccak256` of the canonical residency JSON, so anyone can check the listing wasn't edited after deploy.
4. **Activation happens at the deadline, not before.** Members stake until the deadline. At the deadline, if seats ≥ minimum, the residency is **Active** and the host can withdraw with receipts. Otherwise it **Failed** and everyone claims a full refund. The host can cancel before the deadline (everyone refunds) and close after activation (unspent money returns pro-rata to stake).
5. **The database is only written after the chain confirms.** A new residency or approval is recorded when the client posts the transaction hash and the server reads the receipt and decodes the event. The database can't claim something the chain doesn't show.

---

## 1. User flows

| Flow | Steps | Onchain |
|---|---|---|
| **Launch a city** | Form → city page (no transaction) | — |
| **Propose a residency** | Pick city → form → reviewed by core team | — |
| **Approve a proposal** | Core team approves or rejects | — |
| **Deploy** | Proposer calls deploy on the approved proposal | `createResidency` |
| **Sign in** | Connect a wallet (MetaMask, Rainbow, Ronin Wallet, WalletConnect) → sign in with Ethereum | — |
| **Verify** | "Verify you're human" → World App scan (Proof of Human) → tick "I confirm I'm 18 or older" | — |
| **Apply** | Residency page → Apply → name, bio, social links, preferred bed | — |
| **Review** | Host dashboard → each application: Approve (pick bed + price) or Deny | `approve` / `revoke` |
| **Stake** | Approved member → "Pay 1,000 USDC to hold your bed" → USDC approve + stake | `stake` |
| **Deadline** | Shown automatically as Active or Failed | derived |
| **Withdraw** | Host → amount + receipt file + note | `withdraw` |
| **Receipts** | Members see every withdrawal and can open the receipt file | — |
| **Claim** | Failed or cancelled: full refund. Closed: pro-rata leftovers | `claim` |

## 2. Smart contracts

### 2.1 `ResidencyFactory`

| Function | Notes |
|---|---|
| `createResidency(ResidencyParams p) → address` | Deploys `new Residency(msg.sender, usdc, p)`. Emits `ResidencyCreated(residency, host, metadataHash)` |
| `allResidencies()` / `residenciesLength()` | For completeness. The app lists from the database |

### 2.2 `Residency`

**Parameters (immutable):** `host`, `usdc`, `metadataHash`, `startTime`, `endTime`, `deadline`, `minSeats`, `maxSeats`.
**Checks at construction:** `endTime - startTime ≥ 7 days`, `deadline ≤ startTime`, `deadline > now`, `1 ≤ minSeats ≤ maxSeats ≤ 500`.

| Function | Who | Rule |
|---|---|---|
| `approve(member, bedId, price)` | host | Before the deadline, not cancelled. Member hasn't staked. The bed isn't held by another member. `price > 0`. Re-approving an unstaked member moves them to a new bed |
| `revoke(member)` | host | Only if the member hasn't staked. Frees the bed |
| `stake()` | approved member | Before the deadline, not cancelled, `seatCount < maxSeats`. Transfers exactly the approved price |
| `cancel()` | host | Before the deadline. Everyone can claim a full refund |
| `withdraw(amount, receiptHash, note)` | host | Status Active. `amount ≤ balance` |
| `close()` | host while Active; anyone after `endTime` | Snapshots the balance for pro-rata leftovers |
| `claim()` | staker | Failed or cancelled → full stake back. Closed → `closedBalance × stake / totalStaked`. Once per address |

**Status:** `Open` (before the deadline) → `Active` (deadline passed, seats ≥ min) → `Closed`. `Failed` = deadline passed with seats < min, or cancelled.

**Safety:** OpenZeppelin `SafeERC20` and `ReentrancyGuard`, checks-effects-interactions. No proxy, no owner beyond the per-residency host, no external calls except USDC. Deposits can never exceed the approved prices of at most `maxSeats` members. Anyone can close after `endTime`, so a vanished host can't lock leftovers.

**Events:** `Approved`, `Revoked`, `Staked`, `Cancelled`, `Withdrawn(amount, receiptHash, note)`, `Closed(closedBalance)`, `Claimed(member, amount)`.

### 2.3 Tests (Foundry)

Happy path; minimum missed → refunds; cancel → refunds; max seats; bed double-booking; revoke after stake reverts; access control; pro-rata leftovers with mixed prices; anyone-can-close after end; a fuzz invariant (USDC held ≥ everything owed); a mainnet-fork test against real USDC.

## 3. Web app

### 3.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + Tailwind | One deployable on Vercel; API routes are the backend |
| Wallets | RainbowKit + wagmi v2 + viem | Ready-made MetaMask, Rainbow, Ronin Wallet and WalletConnect buttons |
| Sign-in | SIWE (`viem/siwe`), session in an HTTP-only signed cookie (`jose`) | Every write API knows which wallet is calling |
| Humanity | `@worldcoin/idkit` 4.x widget + `@worldcoin/idkit-core/signing` on the server | Current SDK; RP signature server-side as World requires |
| Database | Postgres (`postgres` driver, plain SQL) | Neon in production, local Postgres in dev |
| Receipts | Stored in Postgres (`bytea`, ≤ 4 MB) and served only to stakers and the host | Private, no extra service. The onchain `receiptHash` is its sha256 |
| Chain reads | viem public client; multicall for listing status | No indexer needed at this scale |

### 3.2 Data model

| Table | Columns |
|---|---|
| `users` | `address` PK, `nullifier` NUMERIC(78,0) UNIQUE, `verified_at`, `adult_attested_at` |
| `profiles` | `address` PK, `name`, `bio`, `links` JSONB, `photo` BYTEA, `photo_mime`, `listed`, timestamps |
| `cities` | `id` BIGSERIAL PK, `slug` UNIQUE, `name`, `location`, `mission`, `description`, `start_time`, `end_time`, `founder`, timestamps |
| `city_core_team` | `(city_id, address)` PK, `role` (founder/core), `added_by` |
| `residency_series` | `id` BIGSERIAL PK, `slug` UNIQUE, `name`, `description`, `owner` |
| `residency_proposals` | `id` BIGSERIAL PK, `city_id`, `series_id`, `proposer`, `metadata_json`, `metadata_hash`, dates, seats, `status` (proposed/approved/rejected/deployed) |
| `residencies` | `address` PK, `host`, `metadata_json`, `metadata_hash`, dates, seats, `created_tx`, `created_block`, `city_id`, `series_id`, `proposal_id`, `hidden`, `hidden_note` |
| `applications` | `id`, `residency`, `applicant`, `name`, `bio`, `links` JSONB, `preferred_bed`, `status`, `bed_id`, `price_units`, `decision_tx`, timestamps |
| `receipts` | `id`, `residency`, `tx_hash`, `receipt_hash`, `filename`, `mime`, `data` bytea |
| `env_snapshots` | `id`, `residency_address`, `start_time`, `end_time`, `temp_avg`, `light_avg`, `door_count`, `data_hash` BYTEA, `signer` BYTEA, `signature` BYTEA, `tx_hash` BYTEA NULL, `created_at` |

**Residency metadata JSON (hashed onchain):** `version`, `cityId` (slug), `seriesId` (slug), `proposalId`, `name`, `location`, `description`, `mission`, `propertyUrl`, `organizers[] {name, bio, link}`, `rooms[] {name, type: private|shared, beds[] {id, label, price}}`. Prices are in USDC.

### 3.3 API routes

| Route | Auth | Does |
|---|---|---|
| `GET /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/me` | — / SIWE | Sign in with Ethereum; session cookie; returns verification status |
| `POST /api/world/rp-context` | session | Signs the IDKit request (`RP_SIGNING_KEY`) |
| `POST /api/world/verify` | session | Forwards the proof to `developer.world.org/api/v4/verify/{rp_id}`, checks the environment, stores the nullifier (a unique constraint means one wallet per human) and the 18+ attestation |
| `GET /api/cities` | — | Paginated listing of active cities |
| `POST /api/cities` | verified | Launch a new city (offchain) |
| `GET /api/cities/[slug]` | — | City + core team + signed-in user's role |
| `PATCH /api/cities/[slug]` | core team | Edit city details (dates can't shrink past approved proposals) |
| `POST/DELETE /api/cities/[slug]/team` | core/founder | Add/remove core team members |
| `GET /api/cities/[slug]/proposals` | core team | List proposals for this city |
| `POST /api/cities/[slug]/proposals` | verified | Propose a residency (creates series + proposal) |
| `GET /api/proposals/[id]` | proposer or core team | Proposal detail |
| `POST /api/proposals/[id]` | core team | Approve or reject a proposal |
| `GET /api/residencies` | — | Paginated listing with onchain status; city/series filter |
| `GET /api/residencies/[address]` | — | Single residency |
| `POST /api/residencies` | verified | Record a deployed residency (checks tx against approved proposal) |
| `POST /api/residencies/[address]/visibility` | city core team | Hide a residency with a public note |
| `POST /api/residencies/[address]/apply` | verified | Create or update application |
| `GET /api/residencies/[address]/applications` | host | List applications |
| `POST /api/residencies/[address]/applications/[id]` | host | Deny or confirm approval |
| `POST /api/residencies/[address]/receipts` | host | Upload receipt file after withdrawal |
| `GET /api/residencies/[address]/receipts[/id]` | host or staker | List and download receipts |
| `GET /api/residencies/[address]/environment` | — | Latest house environment snapshot (temperature, light, door events) |
| `POST /api/residencies/[address]/environment/snapshot` | host or device key | Submit a signed hourly environment snapshot |
| `GET /api/residencies/[address]/environment/snapshot/latest` | — | Latest signed snapshot with full EIP-712 verification data |
| `GET /api/directory` | — | Paginated public directory with search + city filter |
| `GET/PUT /api/profiles/me` | session/verified | Read/update own profile |
| `GET /api/profiles/[address]` | — | Public profile with participation |
| `POST /api/profiles/me/photo` | verified | Upload profile photo |
| `GET /api/profiles/[address]/photo` | — | Serve profile photo |
| `GET /api/series/[slug]` | — | Residency series detail |
| `GET /api/series/mine` | session | Series owned by the signed-in wallet |

## 4. Design

**Feel:** Luma. White or near-black background, generous whitespace, rounded cards, one accent colour, and a gradient cover generated from each city/residency name, so there are no image uploads.

| Page | Contents |
|---|---|
| **Header** | "AI City" wordmark · Residencies · Cities · People · Launch · Profile/Verify badge · Connect wallet |
| **`/`** | Hero (mission statement) · four-step "How it works" · 4-column residency grid · 3-column city grid · 4-column directory strip |
| **City card** | Cover gradient · name · location · dates · residency count · core team avatars |
| **Residency card** | Cover gradient · name · city link · location · dates · price range · status pill · seats bar |
| **Person card** | Avatar · name · bio |
| **`/launch`** | City launch form: basics, dates, story |
| **`/cities`** | Full city listing with infinite scroll |
| **`/cities/[slug]`** | Cover · name · location · dates · core team · mission · description · residency grid · proposals (core team) |
| **`/cities/[slug]/manage`** | Edit details form · core team management (founder only for remove) |
| **`/cities/[slug]/propose`** | Series choice (new or existing) · residency form: basics, dates, people, rooms, organizers, story |
| **`/proposals/[id]`** | Full proposal detail · review panel (core team) · deploy panel (proposer) |
| **`/series/[slug]`** | Series info · all instances grid |
| **`/r/[address]`** | Cover · title · location · city + series links · dates · status · seats · deadline countdown · action button · mission · description · rooms table · organizers · treasury |
| **`/r/[address]/manage`** | Host only: stats, applications with approve/deny, withdraw with receipt upload, cancel/close |
| **`/r/[address]/apply`** | Application form (name, bio, links, preferred bed) |
| **`/people`** | Directory with search and infinite scroll |
| **`/people/[address]`** | Avatar · name · verified badge · bio · links · cities · residencies |
| **`/me`** | Profile form · photo upload · preview |
| **Footer** | "Unaudited software. Only deposit what you can afford to lose." · GitHub · contract links |

## 5. Repo

```
Projects/ai-city/
├── contracts/     Foundry: src/{ResidencyFactory,Residency}.sol, test/, script/Deploy.s.sol
├── web/           Next.js app (app/, components/, lib/, db/schema.sql)
├── docs/          architecture-plan.md (this file), SECURITY.md, WORLD-IDKIT-DEBRIEF.md
└── README.md
```

## 6. Launch checklist

| # | Step |
|---|---|
| 1 | World Developer Portal: app, `rp_id`, signing key, action `ai-city-verify-human` |
| 2 | WalletConnect (Reown) project ID, Alchemy mainnet key, Neon database |
| 3 | `forge test` green, including the fork test |
| 4 | Deploy the factory with Etherscan verification, from a hardware or fresh wallet |
| 5 | Vercel env vars; deploy the web app |
| 6 | Smoke test on mainnet with a 1 USDC residency |

---

## What's confirmed vs. inferred

**Confirmed:** decisions from Konrad (Ethereum mainnet, PoH + self-attested 18+, bed and price chosen at approval, city layer with offchain cities and onchain residencies, code in `Projects/ai-city/`). World IDKit 4.x flow, nullifier storage and the lack of 4.0 onchain verification on Ethereum, from World's docs (2026-09-26). Identity Check (`minimum_age`) is in preview.

**Inferred:** that RainbowKit ships a Ronin Wallet connector (check at install). Mainnet gas for `createResidency`: measure with `forge test --gas-report`.

**Open questions:** Identity Check preview access (ask World at their booth). Whether residencies should appear in the listing before they have a single approval. Whether a residency should be able to have more than one host wallet onchain (co-organizers are metadata-only for now).