---
name: ai-city-directory
description: Search AI City's people directory, look up a person's profile and the cities and residencies they've been part of, browse cities, residencies and series, and create or edit your human's own profile.
---

# AI City: directory and browsing

Part of the [AI City skill](../skill.md). Everything here is public except editing your own profile.

**Over MCP** ([mcp.md](mcp.md)), the tools for this file are `search_people`, `get_person`, `list_cities`, `get_city`, `list_residencies`, `get_residency`, `get_series`, `get_my_profile`, `update_my_profile`, `set_my_profile_photo`, `remove_my_profile_photo`. They take the same fields as the HTTP calls below and return the same JSON.

## Search people

```
GET /api/directory?q=<text>&city=<citySlug>&cursor=<n>
```

| Param | Meaning |
|---|---|
| `q` | Case-insensitive match on name **or** bio. Max 80 chars. Omit for everyone. |
| `city` | Only people connected to that city: its core team, residency hosts, and approved applicants |
| `cursor` | Offset from the previous `nextCursor`. 24 per page. |

```json
{
  "profiles": [
    {
      "address": "0xAbC…",
      "name": "Alice Tanaka",
      "bio": "I build soft robots and run a hardware lab.",
      "links": ["https://x.com/alice"],
      "hasPhoto": true,
      "listed": true,
      "verifiedHuman": true
    }
  ],
  "nextCursor": 24
}
```

Only **listed** profiles appear. Search is substring matching, not semantic: for "who here does robotics?", try several short terms (`robot`, `hardware`, `ROS`) and merge the results by address.

## One person

```
GET /api/profiles/{address}
→ { "profile": {…}, "participation": { "residencies": [...], "cities": [...] }, "isSelf": false }
```

- `participation.residencies[]`: `{ address, name, role: "host" | "member", startTime, endTime, city, series }`. Membership is confirmed onchain (they staked).
- `participation.cities[]`: `{ slug, name, roles: ["founder" | "core" | "host" | "resident"] }`.
- Photo: `GET /api/profiles/{address}/photo` (image bytes, 404 if none).
- `404 Profile not found` also covers unlisted profiles. Don't tell your human the person "doesn't exist", only that they aren't in the public directory.

## Browse cities

```
GET /api/cities?cursor=<n>
```

Cities that haven't ended, soonest first, 12 per page. Each has `id, slug, name, location, mission, description, startTime, endTime, founder, residencyCount, coreTeam[]`.

```
GET /api/cities/{slug}
→ { "city": {…, "coreTeam": [{ "address", "role": "founder" | "core", "name" }]}, "myRole": "founder" | "core" | null }
```

## Browse residencies

```
GET /api/residencies?city=<slug>&series=<slug>&all=1&cursor=<n>
```

| Param | Effect |
|---|---|
| none | Live residencies only (status `Open` or `Active`, not yet ended), open ones first by soonest deadline |
| `city` | Only this city's |
| `series` | Only this series' instances |
| `all=1` | Include ended, failed and closed ones |

Each residency:

```json
{
  "address": "0x…",
  "host": "0x…",
  "metadata": {
    "name": "Builders' House Goa #1",
    "location": "Anjuna, Goa, India",
    "propertyUrl": "https://…",
    "mission": "…",
    "description": "…",
    "organizers": [{ "name": "Konrad", "bio": "Builder", "link": "https://…" }],
    "rooms": [
      { "name": "Garden room", "type": "shared", "beds": [{ "id": 1, "label": "Bunk A", "price": "100" }] }
    ]
  },
  "startTime": 1790000000, "endTime": 1791800000, "deadline": 1789500000,
  "minSeats": 2, "maxSeats": 3,
  "city": { "id": 4, "slug": "edge-city-goa", "name": "Edge City Goa" },
  "series": { "slug": "builders-house", "name": "Builders' House" },
  "state": { "status": "Open", "seatCount": 1, "totalStaked": "100000000", "balance": "100000000" }
}
```

- `state.status`: `Open` = taking applications and stakes, `Active` = minimum reached and running, `Failed` = refunding, `Closed` = over, leftovers claimable.
- `state.totalStaked` and `balance` are USDC base units (divide by 1,000,000).
- Seats left = `maxSeats - state.seatCount`. Prices are per bed, in USDC.

Single residency: `GET /api/residencies/{address}` → `{ residency }` (no `state`; read it from the contract, or find it in the list).

## Series

```
GET /api/series/{slug}      → { series: { slug, name, description, owner, owner_name } }
GET /api/series/mine        → { series: [...] }   // session: series your human owns
```

A series' instances: `GET /api/residencies?series={slug}&all=1`.

## Your human's profile

Read: `GET /api/profiles/me` (session) → `{ profile }` or `{ profile: null }`.

Create or replace (verified):

```
PUT /api/profiles/me
{
  "name": "Konrad Gnat",                  // required, 1–80
  "bio": "Builder of Argo…",              // ≤ 1000
  "links": ["https://x.com/konradgnat"],  // ≤ 8, each http(s)
  "listed": true                          // false hides them from the directory
}
```

`PUT` replaces the whole profile: read it first and send every field back, changing only what your human asked for.

Photo (profile must exist first): `POST /api/profiles/me/photo` as `multipart/form-data` with a `file` field (PNG, JPEG or WebP, max 2 MB). Remove it with `DELETE /api/profiles/me/photo`.
