# Security notes

**Status: unaudited.** Contracts written and tested during ETHGlobal Tokyo, 2026-09-26.

## Contract design

- One `Residency` contract per residency, launched by `ResidencyFactory`. No shared pool, no proxy, no upgrade key, no owner beyond each residency's host.
- Only external calls: USDC `transfer` / `transferFrom` through OpenZeppelin `SafeERC20`. `ReentrancyGuard` on every function that moves funds.
- Maximum deposit per residency is bounded by `maxSeats` (≤ 500) × approved prices.
- Refunds are pull-based (`claim()`), so one failing transfer can't block others.
- Anyone can `close()` after `endTime`, so a missing host can't lock leftovers.
- `stake(expectedPrice)` reverts with `PriceChanged` if the host re-approved the member at a different price, so a front-run re-approval can't charge more than the member agreed to, whatever their allowance.
- The host role moves by two-step transfer (`transferHost` → `acceptHost`), so a mistyped address can't become host.
- 180 days after `close()`, the host can `sweep()` rounding dust, unclaimed shares and stray USDC. After a sweep, leftover claims end. Failed residencies are never sweepable, so refunds stay claimable forever.

## Trust assumptions (say these out loud)

- **The host is trusted with withdrawals once a residency is Active**, from the deadline onward, including before `startTime`, up to the full balance. This is deliberate: hosts often pay the venue up front. Receipts make spending visible; they don't prove it, and the contract doesn't check the receipt hash. Members' protection is transparency plus pro-rata return of whatever is unspent.
- **World ID is enforced by the app, not the contract.** World ID 4.0 proofs can't be verified onchain on Ethereum mainnet (verifier lives on World Chain / Arc). The host's onchain `approve` is the enforcement point; the dashboard shows which applicants are verified humans.
- **18+ is self-attested.** World's `minimum_age` Identity Check is in preview; swap it in when available.
- Metadata (rooms, prices, descriptions) lives in Postgres; its keccak256 is onchain, so edits after launch are detectable.

## Tests

- 28 unit and fuzz tests (`Residency.t.sol`), including the price guard, host transfer and sweep; a stateful invariant suite (`Invariant.t.sol`: solvency, seat bound); and a mainnet-fork lifecycle against real USDC (`Fork.t.sol`, skipped without `MAINNET_RPC_URL`).
- Slither (2026-09-26): no findings beyond timestamp comparisons, a zero-address check `transferHost` omits on purpose (zero cancels an offer), and an exact-zero balance check in `sweep`. All reviewed and accepted.
- `web/scripts/e2e-local.mjs`: 37 end-to-end checks through the API and contracts, including access control and receipt hash verification.

## Web app

- SIWE sessions in HTTP-only, SameSite=Lax cookies signed with `SESSION_SECRET`.
- Agent API keys (`aic_` + 32 random bytes) are stored only as sha256 and act with exactly their wallet's rights. They can't create, list or revoke keys, so a leaked key can't entrench itself; revoking takes effect on the next request. Keys can't move money: every transaction is signed by the human's wallet, and `POST /api/tx` only prepares calldata.
- The MCP endpoint refuses requests whose `Origin` isn't this site (DNS-rebinding and cross-site POST guard).
- The World RP signing key, database URL and private RPC stay server-side.
- Database writes for launches and approvals happen only after the server reads the mined transaction's event.
- Receipt uploads are limited to PDF/PNG/JPEG/WebP ≤ 4 MB and served only to the host and stakers.
- `ALLOW_DEV_VERIFY` bypasses World ID for local testing and is hard-disabled when `NODE_ENV=production`.
