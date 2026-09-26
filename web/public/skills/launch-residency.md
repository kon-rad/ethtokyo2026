---
name: ai-city-launch-residency
description: Launch a residency on AI City. Apply to a city by proposing a residency (rooms, beds, prices, dates), get your human to deploy its Residency contract once the city's core team approves, then help them run it as host - review applicants, hand off on-chain approvals, withdrawals against receipts, and closing.
---

# AI City: launch and host a residency

Part of the [AI City skill](../skill.md).

A residency goes through three stages:

1. **Propose.** Offchain. This is your human's application to the city. Needs a verified session.
2. **Core team approves.** Out of your hands. Poll `GET /api/proposals`.
3. **Deploy.** One on-chain transaction, **signed by your human** ([auth.md](auth.md#handing-off-a-transaction)).

Then your human is the **host**. You never sign anything: you prepare, they sign, you verify.

## 1. Propose (apply to a city)

Read the city first: `GET /api/cities/{slug}`. The residency's dates must fall inside the city's.

Collect from your human:

| Field | Rule |
|---|---|
| `name` | 3–80 |
| `location` | 2–120 |
| `propertyUrl` | `""` or an http(s) URL |
| `mission` | 10–1000 |
| `description` | 20–5000 |
| `organizers` | 1–10 × `{ name (1–80), bio (≤500), link ("" or URL) }` |
| `rooms` | 1–50 × `{ name, type: "private" \| "shared", beds: 1–20 × { label, price } }` |
| `startTime`, `endTime` | Unix seconds, inside the city's window, **at least 7 days apart** |
| `deadline` | Unix seconds, in the future, on or before `startTime`. Stakes close here; below `minSeats` at this point means everyone is refunded. |
| `minSeats`, `maxSeats` | `1 ≤ minSeats ≤ maxSeats ≤ number of beds`, max 500 |
| `series` | `{ "newSeries": { "name", "description" } }` for a first edition, or `{ "seriesSlug": "…" }` for the next edition of a series your human owns (`GET /api/series/mine`) |

`price` is a decimal USDC string per bed for the whole stay: `"850"` or `"850.50"`, up to 6 decimals, more than zero.

```
POST /api/cities/{slug}/proposals
{
  "name": "Builders' House Goa #1",
  "location": "Anjuna, Goa, India",
  "propertyUrl": "https://example.com/villa",
  "mission": "Ship something real.",
  "description": "Three weeks of building with a shared kitchen and fast wifi.",
  "organizers": [{ "name": "Konrad Gnat", "bio": "Builder", "link": "https://x.com/konradgnat" }],
  "rooms": [
    { "name": "Garden room", "type": "shared",
      "beds": [{ "label": "Bunk A", "price": "100" }, { "label": "Bunk B", "price": "100" }] },
    { "name": "Sea view", "type": "private", "beds": [{ "label": "Queen", "price": "200" }] }
  ],
  "startTime": 1791158400, "endTime": 1792800000, "deadline": 1790553600,
  "minSeats": 2, "maxSeats": 3,
  "series": { "newSeries": { "name": "Builders' House", "description": "A recurring builder residency" } }
}
→ { "proposal": { "id": 12, "seriesSlug": "builders-house" } }
```

Beds are numbered `1..n` in the order listed across rooms (above: Bunk A = 1, Bunk B = 2, Queen = 3). Validation errors name the field: `400 maxSeats: Only 3 beds listed`.

Before you send it, read the whole proposal back to your human. **Nothing can be edited after submission.** A change means a new proposal.

## 2. Wait for the core team

```
GET /api/proposals            → { proposals: [...] }   // all of your human's proposals
GET /api/proposals/{id}       → { proposal, isProposer, myRole }
```

`status`: `proposed` (waiting), `approved` (deploy now), `rejected` (read `reviewNote`), `deployed` (done, see `residencyAddress`). If `deadlinePassed` turns true before approval, it can't be approved: propose again with new dates.

## 3. Deploy (your human signs)

Only the proposer's wallet can deploy, and only while `status === "approved"`.

**Hand off:**

> "The Edge City Goa core team approved *Builders' House Goa #1*. To make it live, open `<BASE>/proposals/12` and click **Deploy now** in *Deploy this residency*. Your wallet will ask you to sign one transaction (gas only, no USDC). It creates the residency's own contract, with the dates, deadline and seats you proposed, and they can't be changed afterwards."

**Verify:** poll `GET /api/proposals/12` until `status === "deployed"`. `residencyAddress` is the new contract, and the page is `/r/{residencyAddress}`. Offer to set up its knowledge base ([knowledge.md](knowledge.md)).

*If they sign in their own wallet tool instead:* the call is `ResidencyFactory.createResidency((metadataHash, startTime, endTime, deadline, minSeats, maxSeats))` on the site's factory address, with every value copied from `proposal.metadataHash` and `proposal.params` unchanged. Get the transaction hash from them, then report it yourself:

```
POST /api/residencies   { "txHash": "0x…", "proposalId": 12 }
→ { "address": "0xResidency…" }
```

The server checks the transaction came from the factory, was sent by the proposer, and matches the proposal's hash, dates and seats exactly.

## 4. Host: review applicants

```
GET /api/residencies/{address}/applications
→ { "applications": [
    { "id": 7, "applicant": "0x…", "name", "bio", "links", "preferred_bed": 2,
      "status": "pending" | "approved" | "denied", "bed_id", "price_units",
      "verified_human": true, "created_at" } ] }
```

Summarise each applicant for your human, with their directory profile if they have one (`GET /api/profiles/{applicant}`), their preferred bed, and which beds are still free. **Your human decides who gets in.**

| Decision | Who acts | How |
|---|---|---|
| **Deny** | You, off-chain | `POST /api/residencies/{address}/applications/{id}` `{ "action": "deny" }` |
| **Approve** for a bed | Your human signs | On `<BASE>/r/{address}/manage` → *Applications* → that applicant's card: pick the bed, approve, sign |
| **Revoke** an unpaid approval | Your human signs | Same card, revoke, sign. The application goes back to `pending`. |

The manage page records approvals and revocations with the API itself. **Verify** by re-reading the applications: `status: "approved"` with `bed_id` and `price_units` set. Then tell your human the guest can now pay.

Constraints to check before the hand-off: one approved guest per bed (`BedTaken`); the price defaults to the bed's listed price in `metadata.rooms`; approvals only work while the contract is `Open` (before the deadline). An approved guest has to be revoked before they can be denied.

*Own wallet tool instead:* `Residency.approve(applicant, bedId, priceUnits)` with `priceUnits = parseUnits(bed.price, 6)`, or `Residency.revoke(applicant)`. Then report the hash: `{ "action": "approved" | "revoked", "txHash": "0x…" }`.

## 5. Host: money

Track state for your human: `GET /api/residencies?city={slug}&all=1` includes `state` (`status`, `seatCount`, `totalStaked`, `balance`, in USDC base units), or read `status()`, `seatCount()`, `balance()` on the contract.

| Situation | What your human does on `<BASE>/r/{address}/manage` | Undo? |
|---|---|---|
| Calling it off before the deadline | *Cancel the residency*. Every staker can claim a full refund. | **No.** Confirm twice. |
| Deadline passed below `minSeats` | Nothing. Status becomes `Failed` and stakers claim refunds. | – |
| `Active`, paying a bill | *Withdraw for expenses*: amount, a note (≤ 280 bytes), and the receipt file (PDF, PNG, JPEG or WebP under 4 MB) | No |
| Residency over | *Close the residency*. The leftover balance becomes claimable pro-rata by stakers. Anyone can close after `endTime`. | No |

For a withdrawal you can prepare everything first: which receipt, the amount in USDC, a note that says what it paid for. Check it against `balance` (`InvalidAmount` if it exceeds it). The page hashes the file, signs `withdraw(amount, sha256(file), note)` and uploads the receipt. **Verify:** `GET /api/residencies/{address}/receipts` lists it.

*Own wallet tool instead:* compute `receiptHash = sha256(fileBytes)` (viem `sha256(toHex(bytes))`), have your human sign `withdraw(parseUnits(amount, 6), receiptHash, note)`, then upload the same bytes: `POST /api/residencies/{address}/receipts` as multipart with `file` and `txHash`. A different file fails with `File doesn't match the receipt hash onchain`.
