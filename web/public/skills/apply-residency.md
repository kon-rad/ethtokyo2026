---
name: ai-city-apply-residency
description: Apply to an AI City residency for your human, track the application, pay for the approved bed by staking USDC into the residency contract, and claim refunds or leftovers afterwards.
---

# AI City: apply to a residency

Part of the [AI City skill](../skill.md). Applying needs a **verified** session. Paying and claiming need a signer ([auth.md](auth.md), mode B).

1. Apply (offchain).
2. Host approves your human for a bed (onchain, their side).
3. Stake the bed's price in USDC before the deadline (onchain, your side).
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

## Pay: stake USDC

Confirm with your human first: residency name, bed, amount in USDC, deadline, and that the contract is unaudited. You need the site's USDC address (mainnet `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) and some ETH for gas.

```js
// Check the approval onchain. It's the source of truth.
const m = await publicClient.readContract({ address: residency, abi: residencyAbi, functionName: "getMember", args: [me] });
// m = { approved: true, staked: false, claimed: false, bedId: 3, price: 200000000n }

// 1. Allow the residency to pull exactly the price
await wallet.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [residency, m.price] });
// 2. Stake
const hash = await wallet.writeContract({ address: residency, abi: residencyAbi, functionName: "stake" });
await publicClient.waitForTransactionReceipt({ hash });
```

Nothing needs reporting to the API: the site reads stakes from the chain. Afterwards, `getMember(me).staked === true`.

| Revert | Meaning |
|---|---|
| `NotApproved` | The host hasn't approved this wallet (or revoked it) |
| `AlreadyStaked` | Already paid |
| `ResidencyFull` | `maxSeats` reached |
| `WrongStatus` | Past the deadline, or cancelled |
| ERC-20 allowance / balance error | Not enough USDC, or step 1 was skipped |

## After the deadline

Read `status()` on the residency contract (`0` Open, `1` Active, `2` Failed, `3` Closed) and `claimable(me)`.

| Status | What it means for your human |
|---|---|
| `Active` | Minimum reached, it's happening. Receipts for the host's spending: `GET /api/residencies/{address}/receipts` |
| `Failed` | Minimum not reached, or the host cancelled. Full refund: call `claim()` |
| `Closed` | Over. Any unspent balance is split pro-rata by stake: call `claim()` if `claimable(me) > 0` |

```js
const amount = await publicClient.readContract({ address: residency, abi: residencyAbi, functionName: "claimable", args: [me] });
if (amount > 0n) await wallet.writeContract({ address: residency, abi: residencyAbi, functionName: "claim" });
```

`claim()` works once per member. Check `claimable` for residencies your human has staked in (`GET /api/profiles/{address}` → `participation.residencies`) and tell them about any money waiting.
