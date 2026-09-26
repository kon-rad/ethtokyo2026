# Security notes

**Status: unaudited.** Contracts written and tested during ETHGlobal Tokyo, 2026-09-26.

## Contract design

- One `PopupCity` per city. No shared pool, no proxy, no upgrade key, no owner beyond each city's host.
- Only external calls: USDC `transfer` / `transferFrom` through OpenZeppelin `SafeERC20`. `ReentrancyGuard` on every function that moves funds.
- Maximum deposit per city is bounded by `maxSeats` (≤ 500) × approved prices.
- Refunds are pull-based (`claim()`), so one failing transfer can't block others.
- Anyone can `close()` after `endTime`, so a missing host can't lock leftovers.
- Rounding dust (at most a few micro-USDC) stays in the contract.

## Trust assumptions (say these out loud)

- **The host is trusted with withdrawals once a city is Active.** Receipts make spending visible; they don't prove it. Members' protection is transparency plus pro-rata return of whatever is unspent.
- **World ID is enforced by the app, not the contract.** World ID 4.0 proofs can't be verified onchain on Ethereum mainnet (verifier lives on World Chain / Arc). The host's onchain `approve` is the enforcement point; the dashboard shows which applicants are verified humans.
- **18+ is self-attested.** World's `minimum_age` Identity Check is in preview; swap it in when available.
- Metadata (rooms, prices, descriptions) lives in Postgres; its keccak256 is onchain, so edits after launch are detectable.

## Tests

- 22 unit tests + fuzz (`PopupCity.t.sol`), stateful invariant suite (`Invariant.t.sol`: solvency, seat bound), mainnet-fork lifecycle against real USDC (`Fork.t.sol`).
- `web/scripts/e2e-local.mjs`: 37 end-to-end checks through the API and contracts, including access control and receipt hash verification.

## Web app

- SIWE sessions in HTTP-only, SameSite=Lax cookies signed with `SESSION_SECRET`.
- The World RP signing key, database URL and private RPC stay server-side.
- Database writes for launches and approvals happen only after the server reads the mined transaction's event.
- Receipt uploads are limited to PDF/PNG/JPEG/WebP ≤ 4 MB and served only to the host and stakers.
- `ALLOW_DEV_VERIFY` bypasses World ID for local testing and is hard-disabled when `NODE_ENV=production`.
