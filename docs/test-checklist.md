# AI City — Manual Test Checklist
### What to click through before calling the Sepolia build demo-ready

**Written:** 2026-09-27
**Build under test:** `city-layer` @ `167e5d9`. Contracts are the price-guarded `Residency` with host transfer and sweep.
**Automated coverage already green:** 30 Foundry tests, 53/53 `e2e-local.mjs` checks (API + contracts on anvil). This list covers what those don't: real wallets, real UI, real chain timing.

---

## Where to test

| Environment | Chain | Addresses | Use it for |
|---|---|---|---|
| **Local + Sepolia** | Sepolia (11155111) | Factory `0x7A2E3f097Abd3c1a59D5a762f29d1f02E5A63f89`, mock USDC `0x0Abd146EB01d8b923C2162489E006b7b01C77A57`, deploy block 11787037 | Real-wallet flows: MetaMask **and Ronin** |
| **Local + anvil** | 31337 | Factory `0xe7f1…0512`, USDC `0x5FbD…0aa3` | Anything that needs time travel: deadline, end date, 180-day sweep |
| **Droplet** | Sepolia | same as above | Read-only smoke test. Sign-in fails until the droplet has a domain + TLS. |

**Before you start:**
- `web/.env.local` currently points at **Sepolia** and the local database is **empty**. The anvil seed script (`seed-local.mjs`) only works against anvil. To get the anvil demo back, point `.env.local` at anvil (chain 31337, the addresses above), then reset the DB and run `migrate.mjs`, `import-knowledge.mjs` and `seed-local.mjs`.
- Sepolia wallets: the deployer `0xff7b…7E64` holds 100,000 mock USDC and ~0.097 Sepolia ETH. Every test wallet needs a little Sepolia ETH for gas and some mock USDC. Mock USDC has an open `mint(address,uint256)`, so anyone can mint it.
- Use three wallets: **Host**, **Alice** (guest), **Bob** (second guest / next host).

---

## 1. Sign-in and identity

| # | Test | Expected |
|---|---|---|
| 1.1 | Connect MetaMask on Sepolia, sign the SIWE message | Header shows the address; no gas prompt |
| 1.2 | Connect **Ronin Wallet** on Sepolia, sign in | Signature prompt appears in Ronin (it never did against anvil) |
| 1.3 | Connect on the wrong network (e.g. mainnet) | App asks to switch to Sepolia; nothing breaks |
| 1.4 | `/verify` → "Dev: skip World ID" (local only) | Verified badge; launch and apply unlock |
| 1.5 | Sign out, reload, sign back in | Session survives reload; sign-out clears it |

## 2. City and proposal (offchain)

| # | Test | Expected |
|---|---|---|
| 2.1 | Host launches a city at `/launch` | Appears in `/cities` instantly; host is founder |
| 2.2 | Founder adds Alice to the core team | Alice sees core role on the city page |
| 2.3 | Host proposes a residency with dates **inside** the city window | Proposal created, status `proposed` |
| 2.4 | Propose with dates **outside** the window, or under 7 days | Rejected with a clear message |
| 2.5 | A stranger opens the proposal URL | 403 / not visible |
| 2.6 | Alice (core) approves; then rejects a second proposal with a note | Status updates; proposer sees the note |

## 3. Deploy a residency (onchain)

| # | Test | Expected |
|---|---|---|
| 3.1 | Proposer clicks Deploy, signs `createResidency` | Tx on Sepolia Etherscan; redirect to `/r/0x…?launched=1` |
| 3.2 | Residency page shows dates, seats, deadline countdown, $0 held | Matches the proposal exactly |
| 3.3 | Someone other than the proposer tries to deploy | Button absent / API rejects |

## 4. Apply, approve, pay — including the new price guard

| # | Test | Expected |
|---|---|---|
| 4.1 | Alice applies with a preferred bed | Host dashboard lists her as verified, pending |
| 4.2 | Host approves Alice for a bed (onchain tx) | Alice's page: "You're approved… Pay N USDC" |
| 4.3 | Alice: Step 1 "Allow N USDC", then Step 2 "Pay N USDC" | Seat count +1, "You're in ✓", balance held rises by N |
| 4.4 | **Price guard.** Host approves Bob at price A. Bob completes Step 1 (allow A). Before Bob pays, host re-approves Bob at a **higher** price B | Bob's page switches back to Step 1 for price B; he is never charged B without re-allowing it |
| 4.5 | **Price guard, own tool.** With Bob approved at B and an allowance ≥ B, call `stake(A)` directly (Etherscan write tab or `cast send`) | Reverts with `PriceChanged(B)`; no USDC moves |
| 4.6 | Host tries to approve a second wallet for Alice's bed | `BedTaken` error shown |
| 4.7 | Host revokes an unpaid approval | Bed frees; revoking a paid member is impossible |
| 4.8 | Fill to `maxSeats`, then another approved guest tries to pay | `ResidencyFull` |

## 5. Deadline outcomes (anvil — needs time travel)

Advance time locally: `cast rpc evm_increaseTime <seconds> --rpc-url http://127.0.0.1:8545 && cast rpc evm_mine --rpc-url http://127.0.0.1:8545`

| # | Test | Expected |
|---|---|---|
| 5.1 | Minimum **not** met, pass the deadline | Status Failed; every payer sees "Claim N USDC"; claim returns the full price |
| 5.2 | Host cancels before the deadline | Status Failed; full refunds; cancel button gone |
| 5.3 | Minimum met, pass the deadline | Status Active; Withdraw card appears for host |
| 5.4 | Try to pay after the deadline | Button gone / `WrongStatus` |

## 6. Withdraw, receipts, close, claim

| # | Test | Expected |
|---|---|---|
| 6.1 | Host withdraws with a PDF receipt and a note | Tx succeeds, receipt uploads, "visible to members" |
| 6.2 | Alice (staked) opens the receipt from the residency page | Downloads; its sha256 matches the `Withdrawn` event |
| 6.3 | A non-member requests the receipt | 403 |
| 6.4 | Withdraw more than the balance, or a note over 280 chars | Rejected |
| 6.5 | Host closes; Alice claims | Alice gets her pro-rata share of what's left |
| 6.6 | A stranger closes before `endTime` / after `endTime` | Before: `CloseNotAllowed`. After: succeeds |

## 7. Host handover (new)

| # | Test | Expected |
|---|---|---|
| 7.1 | Host dashboard → "Hand over hosting" → Bob's address | "Waiting for 0x… to accept"; host still in control |
| 7.2 | Host cancels the offer | Bob no longer sees the accept button |
| 7.3 | Re-offer; Bob opens the residency page and clicks "Accept host role" | Page refreshes with Bob as host; Bob can open `/r/…/manage` |
| 7.4 | Old host opens `/r/…/manage` | "Only the host wallet can manage this residency" |
| 7.5 | Bob withdraws (if Active) | USDC goes to **Bob**, not the old host |
| 7.6 | A third wallet calls `acceptHost()` directly | `NotPendingHost` |

## 8. Sweep (new, anvil only — needs 180 days)

| # | Test | Expected |
|---|---|---|
| 8.1 | Close a residency; host dashboard shows "Sweep leftovers" with a date 180 days out | Button disabled |
| 8.2 | Advance 180 days (`15552000` s); host sweeps | Unclaimed balance goes to host; guests' "Claim" disappears |
| 8.3 | A failed residency, any time later | No sweep card; `sweep()` reverts `WrongStatus` |

## 9. Docs and public pages

| # | Test | Expected |
|---|---|---|
| 9.1 | `/docs/contracts` | Shows **Sepolia**, factory + USDC link to sepolia.etherscan.io; every function card present |
| 9.2 | Deep links `/docs/contracts#stake`, `#transferHost`, `#sweep` | Scroll to the card |
| 9.3 | `/docs` → "Contract reference →" in the sidebar and the Smart contracts section | Opens `/docs/contracts` |
| 9.4 | `/people`, `/people/<addr>`, `/series/<slug>`, `/r/<addr>/board` | Render; participation reflects onchain stakes |
| 9.5 | Phone width (375 px) on the residency page and docs | No horizontal scroll; tables wrap or scroll inside their box |

## 10. Concierge and knowledge bases

| # | Test | Expected |
|---|---|---|
| 10.1 | Founder uploads a markdown file and a PDF to the city knowledge base | Both listed; PDF text extracted |
| 10.2 | Ask the residency concierge something only the city file answers | Answer cites the city knowledge |
| 10.3 | A non-founder tries to edit city knowledge | Read-only with the "Only the city's founder…" note |

## 11. Hardware seat key (Pi 4 + Zero + Arduino)

Set `RESIDENCY_ADDRESS` to a Sepolia residency and `RPC_URL` to a Sepolia RPC.

| # | Test | Expected |
|---|---|---|
| 11.1 | Orchestrator starts | Prints the seat count and the status (Open/Active/Failed/Closed) |
| 11.2 | LED bar | Lights one segment per paid seat |
| 11.3 | Zero holding a **staked** wallet, residency Active, date inside the stay | Door opens 8 s, then re-locks |
| 11.4 | Zero holding an approved-but-unpaid wallet | "Access denied — not seated" |
| 11.5 | Active but before `startTime` | Denied. Date check, not just status |
| 11.6 | Unplug the Zero | Door locks within one poll (5 s) |

## 12. Droplet smoke test (read-only)

| # | Test | Expected |
|---|---|---|
| 12.1 | `/`, `/cities`, `/docs`, `/docs/contracts`, `/skill.md` over the droplet IP | 200; docs show Sepolia addresses |
| 12.2 | Try to sign in | Fails, as known: `Secure` cookies are dropped over plain HTTP |

---

## Open questions and blockers

- **Demo data on Sepolia.** There's no Sepolia seed script. Seeding Edge City Goa there needs Host/Alice/Bob wallets with Sepolia ETH. Decide whether to fund three wallets from the deployer, or keep the seeded demo on anvil.
- **Deployer nonce is 4, but the deploy broadcast shows 3 transactions.** One earlier transaction from `0xff7b…7E64` isn't accounted for in the repo. Check it on sepolia.etherscan.io.
- **Contracts are not verified on Etherscan.** No Etherscan API key in either `.env`. Until they are, people can't read the source on the explorer. `/docs/contracts` is the only readable reference.
- **Droplet sign-in** needs a domain + TLS, and a real World ID staging app for non-dev verification.
