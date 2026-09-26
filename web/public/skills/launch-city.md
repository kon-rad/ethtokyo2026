---
name: ai-city-launch-city
description: Launch a pop-up city on AI City, edit its page, manage its core team, review the residency proposals people submit to it, and hide residencies that break its rules.
---

# AI City: launch and run a city

Part of the [AI City skill](../skill.md). Launching needs a **verified** API key or session ([auth.md](auth.md)). Everything after that needs your human to be on the city's **core team**.

**Over MCP** ([mcp.md](mcp.md)), the tools for this file are `launch_city`, `get_city`, `update_city`, `add_core_team_member`, `remove_core_team_member`, `list_city_proposals`, `get_proposal`, `review_proposal`, `set_residency_visibility`. They take the same fields as the HTTP calls below and return the same JSON.

A city holds no money and has no contract. Launching is a single API call.

## Launch

Gather these from your human. Don't make them up.

| Field | Rule |
|---|---|
| `name` | 3–80 chars. Becomes the slug (`Edge City Goa` → `edge-city-goa`, `-2` added if taken). **The slug never changes**, so get the name right. |
| `location` | 2–120 chars, e.g. `"Anjuna, Goa, India"` |
| `mission` | 10–1000 chars. Why the city exists. |
| `description` | 20–5000 chars. What to expect day to day. |
| `startTime`, `endTime` | Unix seconds, `endTime > startTime`. Residencies must fit inside this window. |

```
POST /api/cities
{
  "name": "Edge City Goa",
  "location": "Anjuna, Goa, India",
  "mission": "Ship something real in three weeks with good people.",
  "description": "Mornings deep work, afternoons swimming, evenings demos. Shared kitchen and fast wifi.",
  "startTime": 1791072000,
  "endTime": 1792886400
}
→ { "slug": "edge-city-goa" }
```

Your human is now the city's **founder**. Its page is `/cities/{slug}`. Next, offer to:

1. Add co-organisers to the core team.
2. Seed the city's knowledge base ([knowledge.md](knowledge.md)) so its concierge can answer questions about it. Only the founder can edit it; every residency in the city's concierge reads it too.
3. Propose the first residency in it ([launch-residency.md](launch-residency.md)).

## Edit

```
PATCH /api/cities/{slug}      // core team
```

Send **all six fields** (same shape as launch). The slug stays the same. The dates can't shrink past an approved or deployed residency (`400 An approved residency falls outside those dates`).

## Core team

```
POST   /api/cities/{slug}/team   { "address": "0x…" }   // any core member adds
DELETE /api/cities/{slug}/team   { "address": "0x…" }   // founder only; founder can't be removed
→ { "coreTeam": [{ "address", "role", "name" }] }
```

To add someone by name, look them up in the directory first ([directory.md](directory.md)) and confirm the address with your human.

## Review residency proposals

People "apply to your city" by proposing a residency in it. Your core team decides.

```
GET /api/cities/{slug}/proposals          // every proposal, newest first
GET /api/proposals/{id}                    // one proposal
```

Each proposal:

```json
{
  "id": 12,
  "status": "proposed",
  "proposer": "0x…", "proposerName": "Alice Tanaka", "proposerVerified": true,
  "city": { "slug": "edge-city-goa", "name": "Edge City Goa" },
  "series": { "slug": "builders-house", "name": "Builders' House" },
  "metadata": { "name", "location", "propertyUrl", "mission", "description", "organizers", "rooms" },
  "params": { "startTime", "endTime", "deadline", "minSeats", "maxSeats" },
  "deadlinePassed": false,
  "reviewNote": null
}
```

Summarise for your human: who's proposing, the dates versus the city's, rooms and price per bed, min/max seats, application deadline, and the proposer's profile and past participation (`GET /api/profiles/{proposer}`). **The decision is theirs.**

```
POST /api/proposals/{id}
{ "decision": "approve" | "reject", "note": "Optional, ≤ 1000 chars, shown to the proposer" }
```

| Error | Meaning |
|---|---|
| `409 This proposal was already approved/rejected/deployed` | Someone on the team got there first |
| `400 Its application deadline has passed…` | Can't approve; the proposer must propose again with new dates |

What gets approved is exactly what gets deployed: the metadata hash is fixed at proposal time and the server rejects a deployment that doesn't match.

## Hide a residency

The core team can remove a residency from the city and all listings, with a public reason. This never touches the contract: members can still claim refunds onchain.

```
POST /api/residencies/{address}/visibility
{ "hidden": true, "note": "Required when hiding, ≤ 500 chars, public" }
{ "hidden": false }     // show it again
```
