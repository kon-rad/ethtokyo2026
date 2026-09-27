---
name: ai-city
description: Act on AI City for your human. Search the people directory, browse cities and residencies, launch a pop-up city, propose and launch a residency, apply to a residency, and read, search and query each city's and residency's knowledge base. Use the HTTP API or the MCP server with an API key your human creates; your human signs every wallet action.
version: 2
---

# AI City: agent skill

AI City is Luma for pop-up cities. A **city** is a place and a time window, stored offchain. Inside a city, verified humans **propose residencies** (dates, rooms, per-bed prices in USDC). The city's **core team** approves a proposal, then the proposer **deploys** it as its own `Residency` contract on Ethereum. Guests **apply**, the host **approves** each guest for a bed onchain, and guests **stake** USDC. If the minimum number of seats isn't reached by the deadline, everyone gets a refund.

You act for your human, but **you never hold their wallet.** Everything off-chain (search, launching a city, proposals, applications, reviews, profiles, knowledge) you do yourself. Every transaction that deploys, approves, pays or moves USDC, you prepare and your human signs. You then check the result.

## Three ways in

| Surface | Use it when | Start here |
|---|---|---|
| **MCP server** at `/api/mcp` | Your client speaks MCP (Claude Code, Claude Desktop, Cursor…). 40 typed tools. | [`/skills/mcp.md`](skills/mcp.md) |
| **HTTP API** | Anything that can make HTTP requests. Every call is listed below. | [`/skills/auth.md`](skills/auth.md) |
| **These skill files** | Load them as instructions; they describe the flows over either surface. | This file |

Both surfaces authenticate with an **API key** your human creates at `/me` → *Agent access*, sent as `Authorization: Bearer aic_…`. The MCP server and the HTTP API run the same code, so they have the same rules and the same error messages.

## Skill files

Fetch the one you need. Paths are relative to the site you are talking to.

| File | Use it to |
|---|---|
| [`/skills/auth.md`](skills/auth.md) | Get an API key from your human, check verification, what only your human can do. **Read this first.** |
| [`/skills/mcp.md`](skills/mcp.md) | Connect to the MCP server; every tool, its access level, and the three main flows as tool calls |
| [`/skills/transactions.md`](skills/transactions.md) | Prepare any onchain action as exact calldata, hand it to your human, record and verify it |
| [`/skills/directory.md`](skills/directory.md) | Search people, browse cities, residencies and series, read and edit your human's profile |
| [`/skills/launch-city.md`](skills/launch-city.md) | Launch a city, edit it, manage its core team, review residency proposals, hide residencies |
| [`/skills/launch-residency.md`](skills/launch-residency.md) | Apply to a city by proposing a residency, hand off the deploy once it's approved, then help run it as host |
| [`/skills/apply-residency.md`](skills/apply-residency.md) | Apply to a residency, track the application, hand off paying for the bed and claiming refunds |
| [`/skills/knowledge.md`](skills/knowledge.md) | Read and search a city's or residency's knowledge base (PDF and Word text included), ask its concierge, and add or upload files as founder or host; link your human's Argo journal so a concierge can ask it matchmaking questions |

## Words

| Term | Meaning |
|---|---|
| City | Offchain. Slug, name, location, mission, description, `startTime`, `endTime`. Has a founder and a core team. Holds no money. |
| Series | A recurring residency brand (e.g. "Builders' House"). Owned by one wallet. Each residency is one instance. |
| Proposal | A residency waiting for the city's core team. `proposed` → `approved` / `rejected` → `deployed`. This is how you "apply to a city". |
| Residency | A deployed `Residency` contract, addressed by its contract address. Status is read onchain: `Open`, `Active`, `Failed`, `Closed`. |
| Application | A guest's request for a bed in a residency. `pending` → `approved` / `denied`. |
| Bed | Numbered `1..n` across all rooms in the residency's metadata. Prices are decimal USDC strings like `"850"` or `"850.50"`. |

## Conventions

- **Base URL.** Whatever site your human points you at (production, or `http://localhost:3100` locally). Every path in these files is relative to it.
- **JSON in, JSON out.** Send `content-type: application/json`. Errors come back as `{ "error": "human-readable message" }` with a 4xx status. Show that message to your human; it's written for them.
- **Times are unix seconds** (integers), never ISO strings.
- **USDC has 6 decimals.** The API and metadata use decimal strings (`"100"`). Contracts use base units (`100000000n`). Convert with `parseUnits(price, 6)`.
- **Addresses** are checksummed in responses. Send any case.
- **Pagination.** List endpoints take `?cursor=<n>` and return `nextCursor` (a number, or `null` when there are no more pages).
- **Auth.** `Authorization: Bearer aic_…` on every request that needs it ([auth.md](skills/auth.md)).
- **IDs.** Proposal and application ids may come back as strings (`"12"`). Send them back as they are; the API accepts either.
- **Access levels.** *Public*: no key. *Session*: any valid key (or session cookie). *Verified*: its wallet is World ID verified and 18+. *Core team*, *proposer*, *host*: its wallet holds that role.

## Rules for acting on someone's behalf

1. **Never hold a private key or seed phrase.** Refuse one if it's offered. An AI City API key is fine: it can't move money. Your human signs every transaction ([transactions.md](skills/transactions.md)).
2. **Ask before anything other people will see or that commits your human.** That means launching a city, submitting a proposal or an application, and approving, rejecting or denying someone. Show them exactly what you'll send, then send it.
3. **Never invent your human's details.** Name, bio, links, dates and prices come from them. If a required field is missing, ask.
4. **Read before you write.** Fetch the city or residency first: dates, deadline, status and bed prices decide what's valid.
5. **For transactions: prepare, hand off, record, verify.** `POST /api/tx` gives you the exact calldata and the page that does it. Your human signs. You record the hash where the action needs it, then confirm the result from the API or the chain, not from their word alone.
6. **The contracts are unaudited.** Say so before your human pays anything.

## Everything at a glance

| Action | HTTP | MCP tool | Access |
|---|---|---|---|
| Create / list / revoke API keys | `POST` / `GET /api/keys`, `DELETE /api/keys/{id}` | none, human only | Human, signed in on the site |
| Sign in with a session cookie | Human signs; see auth.md (`/api/auth/nonce` → `/api/auth/verify`) | none | Public |
| Who am I | `GET /api/me` | `whoami` | Public |
| Search people | `GET /api/directory?q=&city=` | `search_people` | Public |
| Person's profile | `GET /api/profiles/{address}` | `get_person` | Public |
| Edit own profile | `PUT /api/profiles/me`, `POST /api/profiles/me/photo` | `update_my_profile`, `set_my_profile_photo` | Verified |
| List cities | `GET /api/cities` | `list_cities` | Public |
| City detail | `GET /api/cities/{slug}` | `get_city` | Public |
| Launch a city | `POST /api/cities` | `launch_city` | Verified |
| Edit a city | `PATCH /api/cities/{slug}` | `update_city` | Core team |
| Add / remove core team | `POST` / `DELETE /api/cities/{slug}/team` | `add_core_team_member`, `remove_core_team_member` | Core team / founder |
| List residencies | `GET /api/residencies?city=&series=&all=1` | `list_residencies` | Public |
| Residency detail | `GET /api/residencies/{address}` | `get_residency` | Public |
| Series | `GET /api/series/{slug}`, `GET /api/series/mine` | `get_series`, `list_my_series` | Public / Session |
| Propose a residency | `POST /api/cities/{slug}/proposals` | `propose_residency` | Verified |
| My proposals | `GET /api/proposals` | `list_my_proposals` | Session |
| City's proposals | `GET /api/cities/{slug}/proposals` | `list_city_proposals` | Core team |
| Approve / reject a proposal | `POST /api/proposals/{id}` | `review_proposal` | Core team |
| Deploy a residency | `POST /api/tx {deploy_residency}`, human signs, then `POST /api/residencies {txHash, proposalId}` | `prepare_transaction`, `record_residency_deploy` | Verified proposer |
| Apply to a residency | `POST /api/residencies/{address}/apply` | `apply_to_residency` | Verified |
| My application | `GET /api/residencies/{address}/apply` | `get_my_application` | Session |
| Pay for a bed | `POST /api/tx {pay_for_bed}`, human signs | `prepare_transaction` | Approved applicant |
| Review applications | `GET /api/residencies/{address}/applications` | `list_applications` | Host |
| Deny an applicant | `POST /api/residencies/{address}/applications/{id}` | `deny_application` | Host |
| Approve / revoke an applicant | `POST /api/tx {approve_applicant \| revoke_applicant}`, human signs, then `POST …/applications/{id} {action, txHash}` | `prepare_transaction`, `record_application_decision` | Host |
| Withdraw, cancel, close | `POST /api/tx {withdraw \| cancel \| close \| sweep}`, human signs; receipts via `POST …/receipts` | `prepare_transaction`, `upload_receipt` | Host |
| Receipts | `GET /api/residencies/{address}/receipts` | `list_receipts`, `upload_receipt` | Host, stakers |
| Refund or leftovers | `POST /api/tx {claim}`, human signs | `prepare_transaction` | Staked member |
| List knowledge files | `GET /api/concierge/{city/slug \| residency/address}/knowledge` | `list_knowledge` | Public |
| Read a file's text | `GET …/knowledge?file={filename}` | `read_knowledge_file` | Public |
| Search knowledge | `GET /api/knowledge/search?q=&city=&residency=` | `search_knowledge` | Public |
| Ask the concierge | `POST /api/concierge/{city/slug \| residency/address}` | `ask_concierge` | Public |
| Write / upload / delete knowledge | `PUT` / `POST` / `DELETE …/knowledge` | `write_knowledge_file`, `upload_knowledge_file`, `delete_knowledge_file` | City founder / residency host |
| Link the Argo journal | `PUT /api/argo/link {handle}` | `link_argo_journal` | Verified |
| Ask the Argo journal (via a concierge) | `POST /api/argo/requests {scope, key, questions?}`; human answers in Argo | `ask_my_argo_journal` | Verified |
| Argo requests and answers | `GET /api/argo/requests` | `list_my_argo_requests` | Key |
| Hand over the host role | `POST /api/tx {transfer_host \| accept_host}`, human signs, then `POST /api/residencies/{address}/host` | `prepare_transaction`, `sync_residency_host` | Host / new host |
| Hide a residency from a city | `POST /api/residencies/{address}/visibility` | `set_residency_visibility` | Core team |

## What only your human can do

| Action | Why | What you do |
|---|---|---|
| Sign in and create your API key | Proves they own the wallet | Ask for a key ([auth.md](skills/auth.md)) |
| World ID verification | Proves a unique human over 18 | Send them to `/verify` |
| Sign any transaction | It moves money or changes the contract | `POST /api/tx`, then hand off ([transactions.md](skills/transactions.md)) |
