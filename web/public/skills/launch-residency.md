---
name: ai-city-launch-residency
description: Launch a residency on AI City. Apply to a city by proposing a residency (rooms, beds, prices, dates), deploy its Residency contract once the city's core team approves, then run it as host - review applicants, approve them onchain, withdraw funds against receipts, close.
---

# AI City: launch and host a residency

Part of the [AI City skill](../skill.md).

A residency goes through three stages:

1. **Propose.** Offchain. This is your human's application to the city. Needs a verified session.
2. **Core team approves.** Out of your hands. Poll `GET /api/proposals`.
3. **Deploy.** One onchain transaction from the proposer's wallet, then report it. Needs a signer ([auth.md](auth.md), mode B).

Then your human is the **host**.

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

## 3. Deploy

Only the proposer's wallet can deploy, and only while `status === "approved"`. Take every argument from the approved proposal as it is. Don't recompute anything.

```js
const { proposal } = await get(`/api/proposals/${id}`);

const hash = await wallet.writeContract({
  address: FACTORY_ADDRESS,            // the site's NEXT_PUBLIC_FACTORY_ADDRESS; ask your human if you don't have it
  abi: factoryAbi,                     // function createResidency((bytes32,uint64,uint64,uint64,uint32,uint32)) returns (address)
  functionName: "createResidency",
  args: [{
    metadataHash: proposal.metadataHash,
    startTime: BigInt(proposal.params.startTime),
    endTime:   BigInt(proposal.params.endTime),
    deadline:  BigInt(proposal.params.deadline),
    minSeats:  proposal.params.minSeats,
    maxSeats:  proposal.params.maxSeats,
  }],
});
await publicClient.waitForTransactionReceipt({ hash });

POST /api/residencies   { "txHash": hash, "proposalId": 12 }
→ { "address": "0xResidency…" }
```

The server checks the transaction came from the factory, was sent by the proposer, and matches the proposal's hash, dates and seats. The residency page is `/r/{address}`. Offer to add a knowledge base for it ([knowledge.md](knowledge.md)).

## 4. Host: review applicants

```
GET /api/residencies/{address}/applications
→ { "applications": [
    { "id": 7, "applicant": "0x…", "name", "bio", "links", "preferred_bed": 2,
      "status": "pending" | "approved" | "denied", "bed_id", "price_units",
      "verified_human": true, "created_at" } ] }
```

Summarise each applicant for your human, with their directory profile if they have one. Your human decides who gets in.

**Approve** (onchain, then report). Look the bed up in `metadata.rooms` and use its listed price unless your human says otherwise:

```js
const hash = await wallet.writeContract({
  address: residency, abi: residencyAbi, functionName: "approve",
  args: [applicant, bedId, parseUnits(bed.price, 6)],
});
await publicClient.waitForTransactionReceipt({ hash });
POST /api/residencies/{address}/applications/{id}   { "action": "approved", "txHash": hash }
```

A bed can hold one approved guest at a time (`BedTaken`). Re-approving an unpaid guest moves them to the new bed and price.

**Deny** (offchain only): `{ "action": "deny" }`. For someone already approved, revoke first.

**Revoke** an approval that hasn't been paid: `Residency.revoke(applicant)`, then `{ "action": "revoked", "txHash": hash }`. The application goes back to `pending`.

Approve, revoke and stake only work while the contract's status is `Open`, i.e. before the deadline.

## 5. Host: money

Read the state with `status()`, `seatCount()`, `totalStaked()`, `balance()` on the residency contract.

| Situation | Action |
|---|---|
| Calling it off before the deadline | `cancel()`. Every staker can claim a full refund. **Irreversible. Confirm twice.** |
| Deadline passed with `seatCount < minSeats` | Status becomes `Failed` automatically. Stakers claim refunds. Nothing for the host to do. |
| Status `Active`, paying for the residency | `withdraw(amount, receiptHash, note)` then upload the receipt (below) |
| Residency over | `close()`. Leftover balance becomes claimable pro-rata by stakers. Anyone can close after `endTime`. |

**Withdraw against a receipt.** The file's sha256 goes onchain and the file itself goes to the API, where stakers can inspect it.

```js
const bytes = await readFile("invoice.pdf");            // PDF, PNG, JPEG or WebP, under 4 MB
const receiptHash = sha256(toHex(bytes));                // viem
const hash = await wallet.writeContract({
  address: residency, abi: residencyAbi, functionName: "withdraw",
  args: [parseUnits("450", 6), receiptHash, "Villa deposit, week 1"],   // note ≤ 280 bytes
});
await publicClient.waitForTransactionReceipt({ hash });

POST /api/residencies/{address}/receipts   (multipart/form-data: file=<the same file>, txHash=<hash>)
```

Upload the exact bytes you hashed, or the server rejects it with `File doesn't match the receipt hash onchain`. List receipts with `GET /api/residencies/{address}/receipts`; download one with `GET …/receipts/{id}` (host and stakers only).
