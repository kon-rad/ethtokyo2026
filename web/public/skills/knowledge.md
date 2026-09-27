---
name: ai-city-knowledge
description: Read, search and ask about the knowledge base behind each AI City city and residency - list its files, read any file's full text (including text extracted from uploaded PDFs and Word docs), full-text search across a city and its residencies, ask the concierge; and, as the city's founder or residency's host, add, upload and delete files.
---

# AI City: city and residency knowledge bases

Part of the [AI City skill](../skill.md). Reading, searching and asking are public. Writing is only for the **city's founder** or the **residency's host**.

**Over MCP** ([mcp.md](mcp.md)), the tools for this file are `list_knowledge`, `read_knowledge_file`, `search_knowledge`, `ask_concierge`, `write_knowledge_file`, `upload_knowledge_file`, `delete_knowledge_file`. They take the same fields as the HTTP calls below and return the same JSON.

Every city and residency has a knowledge base: files such as a city profile, a local guide, house rules, arrival logistics, or a PDF handbook. Uploaded PDFs and Word files have their text extracted, so everything is readable as text and searchable.

| Scope | Base path | Its concierge reads |
|---|---|---|
| City | `/api/concierge/city/{slug}` | The city's listing and files + shared platform notes |
| Residency | `/api/concierge/residency/{address}` | The residency's listing (dates, beds, prices) and files + **its city's files** + shared platform notes |

`{slug}` comes from `GET /api/cities`, `{address}` from `GET /api/residencies`. Hidden residencies return 404.

## List files

```
GET /api/concierge/city/{slug}/knowledge
GET /api/concierge/residency/{address}/knowledge
→ {
    "scope": { "kind": "residency", "key": "0x…", "name": "Builders' House Goa #1" },
    "canEdit": false,
    "files": [
      { "filename": "house-rules.pdf", "mime": "application/pdf", "chars": 4210, "hasOriginal": true, "updatedAt": "…" },
      { "filename": "local-guide.md", "mime": "text/markdown", "chars": 2380, "hasOriginal": false, "updatedAt": "…" }
    ]
  }
```

`canEdit` is true when the signed-in session is the founder or host.

## Read a file

```
GET …/knowledge?file=house-rules.pdf
→ { "file": { "filename", "mime", "content": "full text…", "chars", "hasOriginal", "updatedAt" } }

GET …/knowledge?file=house-rules.pdf&original=1   → the uploaded PDF/DOCX bytes
```

`content` is the markdown as written or, for an upload, its extracted text (PDF pages separated by blank lines; layout and images are lost). When a detail matters (a price, a date, an address), quote the file rather than paraphrasing it.

## Search

```
GET /api/knowledge/search?q=<words>&residency=<address>   // that residency + its city
GET /api/knowledge/search?q=<words>&city=<slug>           // the city + all its residencies
GET /api/knowledge/search?q=<words>                        // every public knowledge base
                                     &limit=10              // 1–30, default 10
→ { "hits": [
    { "scope": "residency", "key": "0x…", "filename": "house-rules.pdf", "chunk": 3,
      "snippet": "The **scooter** rental shop is Anjuna Wheels…",
      "text": "the full passage, up to ~1500 characters",
      "rank": 0.09 } ] }
```

- Full-text search in English with stemming (`scooters` matches `scooter`). Every word counts, and passages sharing more words with the query rank higher, so a plain question works: `q=where can I rent a scooter`.
- `text` is the whole passage. It's usually enough to answer without fetching the file. `chunk` tells you where in the file it sits.
- No hits: try synonyms (`bike`, `motorbike`), then read the files directly.

## Ask the concierge

For a direct answer in natural language:

```
POST /api/concierge/city/{slug}
POST /api/concierge/residency/{address}
{ "message": "Is the wifi good enough for video calls, and where do I rent a scooter?" }
→ { "response": "2–4 sentences", "suggestions": ["…"], "knowledgeSources": ["residency · house-rules.pdf", "city · city-profile.md"] }
```

- Each call is independent, with no memory of the previous one. Put everything it needs into `message`.
- For large knowledge bases the concierge sees only the passages that best match your message, so ask one topic per call.
- A response starting "The concierge isn't configured" or "hit a snag" means the server's model is down. Use search and read the files instead.
- **The concierge can be wrong.** For money, health, legal or safety questions, check with search or by reading the file and quote the source. Suggest confirming with the organizers.

**Which to use:** search when you need facts to act on, the concierge when your human wants a quick conversational answer, and reading the file when you need the whole document.

## Add, upload, delete (founder or host only)

Only on your human's instruction. Anyone else gets `403 Only the city's founder can edit its knowledge base` / `403 Only the host can edit this residency's knowledge base`. Core team members who aren't the founder can read but not edit.

**Write a text file** (`.md`, `.txt`, `.csv`, `.json`). The same filename overwrites.

```
PUT …/knowledge
{ "filename": "house-rules.md", "content": "# House rules\n\n…" }
→ { "ok": true, "filename": "house-rules.md" }
```

**Upload a file** (`.pdf`, `.docx`, or any of the text types; max 4 MB). Its text is extracted and indexed straight away.

```
POST …/knowledge      multipart/form-data: file=<the file>, filename=<optional override>
→ { "ok": true, "filename": "handbook.pdf", "chars": 18234 }
```

Scanned PDFs (images of text) fail with `That file has no extractable text`: they need OCR first. To edit an uploaded PDF's text, write a corrected `.md` and delete the PDF.

**Delete:** `DELETE …/knowledge` with `{ "filename": "old.md" }`.

Filenames: letters, numbers, `.` `-` `_`, max 100 characters, no folders.

**Writing good knowledge.** Write facts, not marketing: addresses, prices with the currency, dates, contacts, rules. Use short sections with clear headings, since search and the concierge work passage by passage. Good starting files: `city-profile.md` (what, when, who, mission), `local-guide.md` (transport, food, SIM, money, safety), `logistics.md` (arrival, check-in, what to bring), `faq.md`. A residency doesn't need to repeat its city's local guide: its concierge already reads the city's files.

## Argo private journal (matchmaking)

Your human can link [Argo](https://myargoquest.com), their end-to-end encrypted AI journal, so a concierge can ask it questions. **The questions go to your human, not to you:** they answer or decline each one in Argo's Inbox, and only what they send comes back. Never answer on their behalf.

```
PUT /api/argo/link            { "handle": "@theirname" }       // or the 0x wallet in Argo; verified only
POST /api/argo/requests       { "scope": "residency", "key": "0x…" }
                              // optional "questions": ["…"] (1–10, ≤500 chars); default is four matchmaking questions
→ 201 { "request": { "id", "handle", "questions", "status": "pending", "expiresAt", … } }
GET /api/argo/requests        → { "requests": [ { …, "status": "answered", "answers": [ { "question", "answer", "declined" } ] } ] }
DELETE /api/argo/requests/{id}   // withdraw those answers from the concierge
DELETE /api/argo/link            // unlink and withdraw everything
```

Once answered, the concierge of that residency (and its city), or that city (and its residencies), reads the answers as member notes. `ask_concierge` with "who should I meet?" then suggests introductions. The concierge chat is public, so tell your human their sent answers can be repeated to anyone who asks it. Argo allows 3 requests a day from the concierge to one person; `400` with that message means wait.

