# AI City: Architecture and Design Plan
### Luma for pop-up cities: launch a city, take applications, stake seats in USDC, refund if it doesn't fill

**Written:** 2026-09-26 (day two of ETHGlobal Tokyo)
**Goal:** A simple, Luma-like dapp on Ethereum mainnet, live by Sun 2026-09-27 09:00 JST and used for the Edge City Goa hacker house.
**Scope:** Ethereum mainnet, native USDC. World ID Proof of Human via IDKit 4.x, plus a self-attested 18+ checkbox (World's `minimum_age` Identity Check is in preview; swap it in when World grants access). The host approves each member for a specific bed at a specific price. Decisions confirmed by Konrad on 2026-09-26. Background: [[residency-mvp-mainnet-plan]].

---

## TL;DR — the five things that matter

1. **One contract per city, deployed by a factory.** Launching a city is one transaction: `AICityFactory.createCity(...)` deploys a `PopupCity`. Each city's USDC sits in its own contract, so a bug or a bad host in one city can't touch another city's money.
2. **Only money and seats go onchain. Everything descriptive lives in Postgres, pinned by a hash.** The name, description, rooms, organizers and applications are rows in a database. The contract stores `keccak256` of the canonical city JSON, so anyone can check the listing wasn't edited after launch.
3. **Activation happens at the deadline, not before.** Members stake until the deadline. At the deadline, if seats ≥ minimum, the city is **Active** and the host can withdraw with receipts. Otherwise it **Failed** and everyone claims a full refund. The host can cancel before the deadline (everyone refunds) and close after activation (unspent money returns pro-rata to stake).
4. **World ID is an app-level gate, checked once per person.** A user verifies Proof of Human once, and the nullifier is stored with their wallet. The API refuses to create cities or applications for unverified wallets. The contract doesn't check World ID: 4.0 proofs can't be verified onchain on Ethereum (only World Chain and Arc), so the host's onchain approval is the enforcement point.
5. **The database is only written after the chain confirms.** A new city or approval is recorded when the client posts the transaction hash and the server reads the receipt and decodes the event. The database can't claim something the chain doesn't show.

---

## 1. User flows

| Flow | Steps | Onchain |
|---|---|---|
| **Sign in** | Connect a wallet (MetaMask, Rainbow, Ronin Wallet, WalletConnect) → sign in with Ethereum | — |
| **Verify** | "Verify you're human" → World App scan (Proof of Human) → tick "I confirm I'm 18 or older" | — |
| **Launch** | Form → review → one transaction → city page | `createCity` |
| **Apply** | City page → Apply → name, bio, social links, preferred bed | — |
| **Review** | Host dashboard → each application: Approve (pick bed + price) or Deny | `approve` / `revoke` |
| **Stake** | Approved member → "Pay 1,000 USDC to hold your bed" → USDC approve + stake | `stake` |
| **Deadline** | Shown automatically as Active or Failed | derived |
| **Withdraw** | Host → amount + receipt file + note | `withdraw` |
| **Receipts** | Members see every withdrawal and can open the receipt file | — |
| **Claim** | Failed or cancelled: full refund. Closed: pro-rata leftovers | `claim` |

## 2. Smart contracts

### 2.1 `AICityFactory`

| Function | Notes |
|---|---|
| `createCity(CityParams p) → address` | Deploys `new PopupCity(msg.sender, usdc, p)`. Emits `CityCreated(city, host, metadataHash)` |
| `allCities()` / `citiesLength()` | For completeness. The app lists from the database |

### 2.2 `PopupCity`

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

**Safety:** OpenZeppelin `SafeERC20` and `ReentrancyGuard`, checks-effects-interactions. No proxy, no owner beyond the per-city host, no external calls except USDC. Deposits can never exceed the approved prices of at most `maxSeats` members. Anyone can close after `endTime`, so a vanished host can't lock leftovers.

**Events:** `Approved`, `Revoked`, `Staked`, `Cancelled`, `Withdrawn(amount, receiptHash, note)`, `Closed(closedBalance)`, `Claimed(member, amount)`.

### 2.3 Tests (Foundry)

Happy path; minimum missed → refunds; cancel → refunds; max seats; bed double-booking; revoke after stake reverts; access control; pro-rata leftovers with mixed prices; anyone-can-close after end; a fuzz invariant (USDC held ≥ everything owed); a mainnet-fork test against real USDC.

## 3. Web app

### 3.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript + Tailwind | One deployable on Vercel; API routes are the backend |
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
| `cities` | `address` PK, `host`, `metadata` JSONB, `metadata_hash`, `start_time`, `end_time`, `deadline`, `min_seats`, `max_seats`, `created_tx`, `created_at` |
| `applications` | `id`, `city`, `applicant`, `name`, `bio`, `links` JSONB, `preferred_bed`, `status` (pending/approved/denied), `bed_id`, `price`, `approved_tx`, timestamps. UNIQUE (`city`, `applicant`) |
| `receipts` | `id`, `city`, `tx_hash`, `receipt_hash`, `filename`, `mime`, `data` bytea, `note` |

**City metadata JSON (hashed onchain):** `name`, `location`, `description`, `mission`, `propertyUrl`, `organizers[] {name, bio, link}`, `rooms[] {name, type: private|shared, beds[] {id, label, price}}`. Prices are in USDC.

### 3.3 API routes

| Route | Auth | Does |
|---|---|---|
| `GET /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/me` | — / SIWE | Sign in with Ethereum; session cookie; returns verification status |
| `POST /api/world/rp-context` | session | Signs the IDKit request (`RP_SIGNING_KEY`) |
| `POST /api/world/verify` | session | Forwards the proof to `developer.world.org/api/v4/verify/{rp_id}`, checks the environment, stores the nullifier (a unique constraint means one wallet per human) and the 18+ attestation |
| `POST /api/cities/prepare` | verified | Validates the form, returns canonical metadata + hash for the transaction |
| `POST /api/cities` | verified | Takes the tx hash, reads the `CityCreated` event, checks the host and hash, stores the city |
| `GET /api/cities?cursor=` | — | Paginated listing for infinite scroll |
| `GET /api/cities/[address]` | — | City + metadata |
| `POST /api/cities/[address]/apply` | verified | Creates or updates the application |
| `GET /api/cities/[address]/applications` | host | Application list |
| `POST /api/cities/[address]/applications/[id]` | host | Deny, or confirm an approval by tx hash (reads the `Approved` event) |
| `POST /api/cities/[address]/receipts` | host | Uploads a file after `withdraw`, checking its sha256 against the event |
| `GET /api/cities/[address]/receipts[/id]` | host or staker | Lists and downloads receipts |

## 4. Design

**Feel:** Luma. White or near-black background, generous whitespace, rounded cards, one accent colour, and a gradient cover generated from each city's name, so there are no image uploads.

| Page | Contents |
|---|---|
| **Header** | "AI City" wordmark · Explore · Launch a city · Verify badge · Connect wallet |
| **`/`** | Hero ("Pop-up cities, funded together") · three-step "How it works" · a 4-column grid of live cities (2 on tablet, 1 on phone) with infinite scroll · footer |
| **City card** | Cover gradient · name · location · dates · "from 600 USDC" · seats "7 / 10 min" bar · status pill |
| **`/verify`** | IDKit button · 18+ checkbox · state: verified ✓ |
| **`/launch`** | Sections: Basics (name, location, property link) · Dates (start, end ≥ 7 days, application deadline) · People (min, max) · Rooms (add room → type → beds with prices) · Organizers (add several) · Story (mission, description) · Review → Launch |
| **`/c/[address]`** | Cover · title · location · dates · status · seats progress · deadline countdown · action button (Apply / Pending / Pay to hold bed / You're in / Claim) · mission · description · rooms table · organizers · property link · **Treasury** (every withdrawal with its note, Etherscan link and receipt, members only) |
| **`/c/[address]/manage`** | Host only: applications (Approve with a bed and price picker / Deny) · withdraw with receipt upload · cancel / close |
| **Footer** | "Unaudited software. Only deposit what you can afford to lose." · GitHub · contract links |

## 5. Repo

```
Projects/ai-city/
├── contracts/     Foundry: src/{AICityFactory,PopupCity}.sol, test/, script/Deploy.s.sol
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
| 6 | Smoke test on mainnet with a 1 USDC city |

---

## What's confirmed vs. inferred

**Confirmed:** decisions from Konrad (Ethereum mainnet, PoH + self-attested 18+, bed and price chosen at approval, code in `Projects/ai-city/`). World IDKit 4.x flow, nullifier storage and the lack of 4.0 onchain verification on Ethereum, from World's docs (2026-09-26). Identity Check (`minimum_age`) is in preview.

**Inferred:** that RainbowKit ships a Ronin Wallet connector (check at install). Mainnet gas for `createCity`: measure with `forge test --gas-report`.

**Open questions:** Identity Check preview access (ask World at their booth). Whether cities should appear in the listing before they have a single approval. Whether a city should be able to have more than one host wallet onchain (co-organizers are metadata-only for now).
