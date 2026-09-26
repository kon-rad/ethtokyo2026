---
name: ai-city-apply-residency
description: Apply to an AI City residency for your human, track the application, then hand off paying for the approved bed (a USDC stake your human signs) and claiming refunds or leftovers afterwards.
---

# AI City: apply to a residency

Part of the [AI City skill](../skill.md). Applying needs a **verified** session. Paying and claiming are transactions **your human signs** ([auth.md](auth.md#handing-off-a-transaction)). You prepare them and check the result.

1. Apply (offchain).
2. Host approves your human for a bed (onchain, their side).
3. Your human stakes the bed's price in USDC before the deadline (on-chain, they sign).
4. After the deadline, the residency is `Active` (it's on) or `Failed` (claim a refund).

## Find one

Use [directory.md](directory.md): `GET /api/residencies?city={slug}`, or `GET /api/residencies/{address}` for one you already know. Before applying, check with your human:

- `state.status === "Open"`. Anything else rejects applications.
- `deadline`: stakes must land before it, so approval needs to happen before then too.
- Dates, location, and the beds with their prices in `metadata.rooms`.
- The city and organizers. For questions the listing doesn't answer, ask the concierge ([knowledge.md](knowledge.md)).

## Apply

Write the application with your human, in their words. The host reads the bio.

| Field | Rule |
|---|---|
| `name` | 2–80 |
| `bio` | 20–2000. Who they are, what they'll work on, why this residency. |
| `links` | ≤ 6 URLs, each starting `http://` or `https://` |
| `preferredBedId` | A bed `id` from `metadata.rooms[].beds[]`, or `null` for no preference |

```
POST /api/residencies/{address}/apply
{
  "name": "Konrad Gnat",
  "bio": "I build Argo, an AI journaling app, and want three weeks heads-down on its agent layer alongside other builders.",
  "links": ["https://x.com/konradgnat"],
  "preferredBedId": 3
}
→ { "application": { "id": 7, "status": "pending" } }
```

Sending it again **edits** the application (it goes back to `pending`, and a denied application can be resubmitted). Once approved, it can't be edited.

| Error | Meaning |
|---|---|
| `400 This residency is no longer taking applications` | Status isn't `Open` |
| `400 Hosts don't apply to their own residency` | Your human is the host |
| `400 Unknown bed` | `preferredBedId` isn't in the metadata |
| `409 You're already approved…` | Go straight to staking |

## Track it

```
GET /api/residencies/{address}/apply
→ { "application": { "id", "status": "pending" | "approved" | "denied",
                     "bed_id": 3, "price_units": "200000000", "decision_tx", … } }
```

`price_units` is what your human owes, in USDC base units (`200000000` = 200 USDC). Tell them the moment status turns `approved`: the bed is held only until someone stakes, and the deadline is fixed.

## Pay: your human stakes USDC

**Prepare.** Confirm the numbers from the chain, not from memory. On the residency contract, `getMember(humanAddress)` should return `{ approved: true, staked: false, bedId, price }`, where `price` is in USDC base units. Also check:

- It's before `deadline` and `state.status === "Open"`.
- `seatCount < maxSeats`.
- Your human's wallet holds at least `price` USDC plus a little ETH for gas.

**Hand off:**

> "You're approved for the Queen bed at Builders' House Goa #1: 200 USDC, due before 2026-10-15. Open `<BASE>/r/0x…`. Click **Step 1 of 2 · Allow 200 USDC** and sign, then **Step 2 of 2 · Pay 200 USDC** and sign. If fewer than 2 people pay by the deadline, you get all of it back. Heads up: the contracts are unaudited."

**Verify:** `getMember(humanAddress).staked === true`, or your human's profile (`GET /api/profiles/{address}`) lists the residency under `participation.residencies` with `role: "member"`. The page shows "You're in ✓".

*Own wallet tool instead:* two transactions. First `USDC.approve(residencyAddress, price)` on the site's USDC contract (mainnet `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`), then `Residency.stake(price)`, passing the approved price from `getMember(wallet).price` (it reverts with `PriceChanged` if the host changed it). Nothing needs reporting to the API: stakes are read from the chain.

| Revert | Meaning |
|---|---|
| `NotApproved` | The host hasn't approved this wallet, or revoked it |
| `AlreadyStaked` | Already paid |
| `ResidencyFull` | `maxSeats` reached |
| `WrongStatus` | Past the deadline, or cancelled |
| ERC-20 allowance / balance error | Not enough USDC, or the approval step was skipped |

## After the deadline

Read `status()` on the residency contract (`0` Open, `1` Active, `2` Failed, `3` Closed) and `claimable(humanAddress)` (USDC base units).

| Status | What it means for your human |
|---|---|
| `Active` | Minimum reached, it's happening. Receipts for the host's spending: `GET /api/residencies/{address}/receipts` (stakers can read them) |
| `Failed` | Minimum not reached, or the host cancelled. Full refund waiting. |
| `Closed` | Over. Unspent balance split pro-rata by stake; claim within 180 days, after which the host can sweep it. |

When `claimable > 0`, **hand off**: "You have 200 USDC to claim from Builders' House Goa #1. Open `<BASE>/r/0x…` and click **Claim 200 USDC**, then sign once." (*Own wallet tool:* `Residency.claim()`.) **Verify:** `claimable` is now `0`. Each member can claim once.

Check `claimable` for every residency your human has staked in (`GET /api/profiles/{address}` → `participation.residencies`) and tell them about any money waiting.
