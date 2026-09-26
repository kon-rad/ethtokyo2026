---
name: ai-city-knowledge
description: Access the knowledge base behind each AI City city and residency - list its files, ask its concierge questions grounded in them, and (as core team or host) add or update files.
---

# AI City: city and residency knowledge bases

Part of the [AI City skill](../skill.md).

Every city and residency can have a knowledge base: markdown files (city profile, local guide, house rules, logistics) that ground an AI **concierge**. Scopes:

| Scope | Files the concierge reads | Base path |
|---|---|---|
| City | `knowledge/cities/{slug}/*.md` + the shared Argo journal | `/api/concierge/city/{slug}` |
| Residency | `knowledge/residencies/{address}/*.md` + the shared Argo journal | `/api/concierge/residency/{address}` |

Use the city slug from `GET /api/cities` and the residency address exactly as the API returns it.

## List files

```
GET /api/concierge/city/{slug}/knowledge
GET /api/concierge/residency/{address}/knowledge
→ { "files": ["city-profile.md", "local-guide.md"] }
```

An empty list means nobody has written a knowledge base for it yet. The concierge will say it doesn't know.

## Ask the concierge

This is how you read a knowledge base. Ask specific questions and ask several; each call is independent, with no memory of the previous one.

```
POST /api/concierge/city/{slug}
POST /api/concierge/residency/{address}
{ "message": "What's the nearest coworking space, and is the wifi good enough for video calls?" }

→ {
    "response": "2–4 sentence answer grounded in the files",
    "suggestions": ["Follow-up question", "…"],
    "knowledgeSources": ["city-profile.md", "local-guide.md"]
  }
```

- `knowledgeSources` lists the files that were in context, not the ones the answer came from.
- Put everything the concierge needs in `message`: dates, what your human cares about, the constraint. It sees nothing else.
- For a full picture (e.g. "brief me on this city before I apply"), ask 4–6 targeted questions (housing, food, transport, visa, community, costs) and merge the answers yourself.
- If `response` starts with "The concierge isn't configured" or "hit a snag", the server has no model key or the model call failed. Tell your human and fall back to the city's `description` and `mission`.
- The concierge can be wrong. For anything with money, health or legal stakes, say where the answer came from and suggest your human confirms with the organizers.

## Add or update a file

Only on your human's instruction, and only for a city whose core team they're on or a residency they host.

```
PUT /api/concierge/city/{slug}/knowledge
PUT /api/concierge/residency/{address}/knowledge
{ "filename": "house-rules.md", "content": "# House rules\n\n…" }
→ { "ok": true, "filename": "house-rules.md" }
```

- `filename` must end in `.md`. The same name overwrites.
- Write facts, not marketing: addresses, prices with currency, dates, contacts, rules. The concierge answers in 2–4 sentences, so short, well-headed sections work best.
- Good starting files: `city-profile.md` (what, when, who, mission), `local-guide.md` (transport, food, SIM, money, safety), `logistics.md` (arrival, check-in, what to bring), `faq.md`.

Delete: `DELETE` on the same path with `{ "filename": "old.md" }`.
