# World IDKit integration debrief

*Fill in during and after integration. Required for the World IDKit prize.*

## Trust moment

Before someone can launch a city or apply for a seat, we need to know they are one unique human: a seat is a scarce, real-world bed, and fake accounts would let one person hold or spam many.

## Credential choice: Proof of Human

Uniqueness is the minimum sufficient assurance. We don't need a name, nationality or document, only "this is one real person, once". Passport or Identity Check would collect more than a bed reservation requires. Age (18+) is self-attested until Identity Check `minimum_age` leaves preview.

## Flows demoed

- **Success:** sign in, verify with World ID, proof verified server-side, nullifier bound to wallet. User can now launch cities and apply for residencies.
- **Alternative paths:**
  - Same World ID used with a second wallet, returns `409 "This World ID is already linked to another wallet"`
  - Cancel in World App, returns `"Verification cancelled in World App."`
  - Unverified user attempts a gated action, returns `403 "Verify you're a human over 18 first"`
  - Proof from wrong environment (staging vs production), returns `400 "Proof is from the staging environment"`
  - Proof for wrong wallet address, returns `400 "This proof was made for a different wallet"`

## Debrief

| Aspect | Detail |
|---|---|
| Time to first successful verification | ~30 minutes from `pnpm add @worldcoin/idkit @worldcoin/idkit-core` to the first completed World App scan. The 4.x API (`IDKitRequestWidget`, `signRequest`) is clean and well-documented — most of the time was wiring the RP signing key and the server-side verify proxy, not the widget itself. |
| Friction | Minimal. The IDKit widget's `handleVerify` callback fires with the full `IDKitResult` including the nullifier, which simplifies the server call. The main gotcha was the environment check: a proof from the staging simulator (simulator.worldcoin.org) comes with `environment: "staging"` and gets rejected if the app expects `production`. The `@worldcoin/idkit-core/hashing` package's `hashSignal` function is undocumented in the main integration guide — found it by reading the source. The Zod validation on the verify endpoint had to use `.passthrough()` on the `idkitResult` because World's response shape isn't fully typed in the public SDK types. |
| Missing docs or capability | Onchain 4.0 verification isn't available on Ethereum mainnet (World Chain / Arc only). |
| Single most impactful improvement | A `requireVerified()` server-side middleware function that checks `verified && adult` on every gated API route in one line. Instead of spreading verification checks across each handler (which invites drift), a single `requireVerified()` call in `lib/server/http.ts` is reused by every write endpoint. Combined with the client-side `RequireVerified` component, the entire gating is two functions — one on the server, one on the client — and every route that needs verification is auditable by searching for `requireVerified` in the codebase. |