---
title: Concierge AI Architecture
subtitle: Matchmaker + Knowledge Base for Cities and Residencies
status: Phase 1 (Foundation) — Live
model: meta-llama/Llama-3.3-70B-Instruct-Turbo (Together AI)
---

## Overview

For every city and every residency on AI City, a Concierge AI agent that acts as a
matchmaker between people and has deep knowledge of the city, the residency, and
Argo's private AI journal.

**Architecture principle:** One generic concierge engine. Per-city and per-residency
instances configured by a knowledge folder. No per-city code — just data.

---

## What the concierge does

| Role | What it does |
|---|---|
| **Matchmaker** | Knows who has applied / been approved. Suggests connections based on shared interests, arrival overlap, and bed proximity. |
| **City guide** | Knows the city's location, dates, mission, core team, amenities, transport, culture. |
| **Residency guide** | Knows house rules, room layout, bed prices, meal plan, host bio, shared spaces. |
| **Argo historian** | Has access to Argo's private AI journal — past learnings from running similar events. |
| **Onboarding assistant** | Answers logistics: check-in time, kitchen access, late arrival, parking. |
| **Social catalyst** | Proposes group activities, dinner plans, skill shares based on who's attending. |

---

## Knowledge sources

Each concierge instance draws from a **knowledge folder** — markdown files on disk
that form its context. No database needed in Phase 1.

### Per-city knowledge folder

```
knowledge/cities/penang-2026/
  city-profile.md       # Name, location, dates, mission, core team
  venue-info.md         # Main gathering space
  local-guide.md        # Transport, food, culture, weather, attractions
  code-of-conduct.md    # Community rules
  faq.md                # Common questions
```

### Per-residency knowledge folder

```
knowledge/residencies/0x1234.../
  residency-profile.md  # Host bio, house rules, room layout, meal plan
  house-manual.md       # WiFi password, door code, appliances
  neighborhood-guide.md # What's around this property
  guest-list.md         # Auto-generated: who's coming, their interests
```

### Shared knowledge

```
knowledge/shared/
  argo-journal/
    learnings.md        # What Argo has learned running events
  templates/
    concierge-prompt.md # Base system prompt template
```

---

## AI integration

### Together AI (Phase 1 — now live)

All concierge calls go through **Together AI** using the Llama 3.3 70B model.

**Endpoint:** `https://api.together.xyz/v1/chat/completions`

**Model:** `meta-llama/Llama-3.3-70B-Instruct-Turbo`

**How it works:**

1. The API route receives `{ message, userAddress? }`
2. Knowledge files are loaded from disk (`knowledge/cities/:slug/` or `knowledge/residencies/:address/`)
3. A system prompt is constructed containing:
   - The concierge base persona
   - All knowledge file contents
   - The current date
4. The user message is appended as a chat turn
5. The full prompt is sent to Together AI
6. The response is returned as `{ response, suggestions, knowledgeSources }`

**Environment variables:**

| Variable | Value |
|---|---|
| `TOGETHER_API_KEY` | Your Together AI API key |
| `TOGETHER_MODEL` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

**Fallback:** If `TOGETHER_API_KEY` is not set, the concierge returns a friendly
message explaining the key is missing rather than crashing.

---

## API design

### Chat endpoints

```
POST /api/concierge/city/:slug
  Body: { message, userAddress? }
  Response: { response, suggestions[], knowledgeSources[] }
  Knowledge loaded from: knowledge/cities/:slug/ + knowledge/shared/

POST /api/concierge/residency/:address
  Body: { message, userAddress? }
  Response: { response, suggestions[], knowledgeSources[] }
  Knowledge loaded from: knowledge/residencies/:address/ + knowledge/shared/
```

### Knowledge management

```
GET    /api/concierge/city/:slug/knowledge       -> { files: string[] }
PUT    /api/concierge/city/:slug/knowledge        -> { ok, filename }
DELETE /api/concierge/city/:slug/knowledge        -> { ok }

GET    /api/concierge/residency/:address/knowledge       -> { files: string[] }
PUT    /api/concierge/residency/:address/knowledge        -> { ok, filename }
DELETE /api/concierge/residency/:address/knowledge        -> { ok }
```

---

## Components

| Component | File | Description |
|---|---|---|
| `ConciergePanel` | `components/concierge-panel.tsx` | Floating chat panel — messages, suggestions, input |
| `KnowledgeEditor` | `components/knowledge-editor.tsx` | Inline markdown editor with preview |
| `KnowledgeManager` | `components/knowledge-manager.tsx` | File list + add/edit/delete controls |

### Page integrations

| Page | Integration |
|---|---|
| `/cities/:slug` | `ConciergePanel` floating chat bubble |
| `/r/:address` | `ConciergePanel` floating chat bubble |
| `/cities/:slug/manage` | `KnowledgeManager` — knowledge base tab for organizers |
| `/r/:address/manage` | `KnowledgeManager` — knowledge base tab for hosts |

---

## Data model

```sql
-- For Phase 2 when we move from filesystem to database

CREATE TABLE city_knowledge (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(city_id, filename)
);

CREATE TABLE residency_knowledge (
  id SERIAL PRIMARY KEY,
  residency_address TEXT REFERENCES residencies(address) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(residency_address, filename)
);
```

**Phase 1:** Knowledge lives on the filesystem at `knowledge/`. The DB tables
are designed but not yet created — ready for Phase 2 when we need persistence
across deployments.

---

## Phased roadmap

### Phase 1 — Foundation (DONE)

- Knowledge folder structure with sample files
- Together AI integration with Llama 3.3 70B
- Chat panel component (ConciergePanel)
- Knowledge management UI (KnowledgeEditor + KnowledgeManager)
- City and residency page integration
- Knowledge CRUD API routes (filesystem-backed)

### Phase 2 — Context management

- System prompt builder with smart truncation
- Conversation history tracking (last N turns)
- User profile injection for personalized responses
- Persona switching (city vs residency)

### Phase 3 — RAG and vector search

- Embedding + vector store for semantic search
- Re-ranking (keyword + recency boost)
- Argo journal semantic search

### Phase 4 — Matchmaker intelligence

- Interest matching across approved guests
- Arrival/departure overlap detection
- Proactive suggestions ("you should meet X")
- Privacy controls (opt-in/out of matchmaking)

---

## What's real vs mocked

| Feature | Phase 1 status |
|---|---|
| Knowledge files | Real `.md` files on disk, loaded at runtime |
| Chat responses | Real — powered by Together AI / Llama 3.3 |
| Live guest list | Mocked (static example data) |
| Matchmaker logic | Delegated to the LLM with knowledge context |
| File management UI | Real — CRUD against filesystem via API |
| Markdown editor | Real component with preview toggle |
| Concierge panel | Real React component with animation, scroll, suggestions |
| Conversation memory | Mocked (single-turn, no history yet) |
| User authentication | Ready but not wired into the concierge context |

---

## Key files

| Path | Purpose |
|---|---|
| `lib/concierge/knowledge.ts` | Load knowledge files from disk, build system prompts |
| `lib/concierge/chat-together.ts` | Together AI chat completions client |
| `app/api/concierge/city/[slug]/route.ts` | City concierge API endpoint |
| `app/api/concierge/residency/[address]/route.ts` | Residency concierge API endpoint |
| `app/api/concierge/city/[slug]/knowledge/route.ts` | City knowledge CRUD |
| `app/api/concierge/residency/[address]/knowledge/route.ts` | Residency knowledge CRUD |
| `components/concierge-panel.tsx` | Chat panel UI |
| `components/knowledge-editor.tsx` | Markdown editor |
| `components/knowledge-manager.tsx` | Knowledge file manager |
| `knowledge/` | All knowledge files (cities, residencies, shared) |