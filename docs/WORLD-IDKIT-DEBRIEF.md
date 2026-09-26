# World IDKit integration debrief

*Fill in during and after integration. Required for the World IDKit prize.*

## Trust moment

Before someone can launch a city or apply for a seat, we need to know they are one unique human: a seat is a scarce, real-world bed, and fake accounts would let one person hold or spam many.

## Credential choice: Proof of Human

Uniqueness is the minimum sufficient assurance. We don't need a name, nationality or document, only "this is one real person, once". Passport or Identity Check would collect more than a bed reservation requires. Age (18+) is self-attested until Identity Check `minimum_age` leaves preview.

## Flows demoed

- Success: sign in → Verify with World ID → proof verified server-side → nullifier bound to wallet.
- Alternative path: the same World ID used with a second wallet → "This World ID is already linked to another wallet" (409). Cancel in World App → "Verification cancelled".

## Debrief

- Time to first successful verification: _TBD_
- Friction: _TBD_
- Missing docs or capability: onchain 4.0 verification isn't available on Ethereum mainnet (World Chain / Arc only).
- Single most impactful improvement: _TBD_
