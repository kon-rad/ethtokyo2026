---
name: ai-city
description: Act on AI City for your human. Search the people directory, browse cities and residencies, launch a pop-up city, propose and launch a residency, apply to a residency, and read, search and query each city's and residency's knowledge base. You do everything off-chain over HTTP; your human signs every wallet action.
version: 1
---

# AI City: agent skill

AI City is Luma for pop-up cities. A **city** is a place and a time window, stored offchain. Inside a city, verified humans **propose residencies** (dates, rooms, per-bed prices in USDC). The city's **core team** approves a proposal, then the proposer **deploys** it as its own `Residency` contract on Ethereum. Guests **apply**, the host **approves** each guest for a bed onchain, and guests **stake** USDC. If the minimum number of seats isn't reached by the deadline, everyone gets a refund.

You act for your human, but **you never hold their wallet.** Everything off-chain (search, launching a city, proposals, applications, reviews, profiles, knowledge) you do over the API below. Everything that needs the wallet (signing in, and every transaction that deploys, approves, pays or moves USDC) your human signs, on a page you send them to. You then check the result.

## Skill files

Fetch the one you need. Paths are relative to the site you are talking to.

| File | Use it to |
|---|---|
| [`/skills/auth.md`](skills/auth.md) | Get a session your human signed, check verification, hand off transactions. **Read this first.** |
| [`/skills/directory.md`](skills/directory.md) | Search people, browse cities, residencies and series, read and edit your human's profile |
| [`/skills/launch-city.md`](skills/launch-city.md) | Launch a city, edit it, manage its core team, review residency proposals, hide residencies |
| [`/skills/launch-residency.md`](skills/launch-residency.md) | Apply to a city by proposing a residency, hand off the deploy once it's approved, then help run it as host |
| [`/skills/apply-residency.md`](skills/apply-residency.md) | Apply to a residency, track the application, hand off paying for the bed and claiming refunds |
| [`/skills/knowledge.md`](skills/knowledge.md) | Read and search a city's or residency's knowledge base (PDF and Word text included), ask its concierge, and add or upload files as founder or host |

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
- **Access levels.** *Public*: no session. *Session*: signed in. *Verified*: signed in, World ID verified and 18+. *Core team*, *proposer*, *host*: signed in as that role.

## Rules for acting on someone's behalf

1. **Never hold a private key or seed phrase.** Refuse one if it's offered. Your human signs every sign-in and every transaction ([auth.md](skills/auth.md)).
2. **Ask before anything other people will see or that commits your human.** That means launching a city, submitting a proposal or an application, and approving, rejecting or denying someone. Show them exactly what you'll send, then send it.
3. **Never invent your human's details.** Name, bio, links, dates and prices come from them. If a required field is missing, ask.
4. **Read before you write.** Fetch the city or residency first: dates, deadline, status and bed prices decide what's valid.
5. **For transactions: prepare, hand off, verify.** Work out the exact action and amount, send your human to the page that does it, then confirm the result from the API or the chain, not from their word alone.
6. **The contracts are unaudited.** Say so before your human pays anything.

## Everything at a glance

| Action | Call | Access |
|---|---|---|
| Sign in | Human signs; see auth.md (`/api/auth/nonce` → `/api/auth/verify`) | Public |
| Who am I | `GET /api/me` | Public |
| Search people | `GET /api/directory?q=&city=` | Public |
| Person's profile | `GET /api/profiles/{address}` | Public |
| Edit own profile | `PUT /api/profiles/me`, `POST /api/profiles/me/photo` | Verified |
| List cities | `GET /api/cities` | Public |
| City detail | `GET /api/cities/{slug}` | Public |
| Launch a city | `POST /api/cities` | Verified |
| Edit a city | `PATCH /api/cities/{slug}` | Core team |
| Add / remove core team | `POST` / `DELETE /api/cities/{slug}/team` | Core team / founder |
| List residencies | `GET /api/residencies?city=&series=&all=1` | Public |
| Residency detail | `GET /api/residencies/{address}` | Public |
| Series | `GET /api/series/{slug}`, `GET /api/series/mine` | Public / Session |
| Propose a residency | `POST /api/cities/{slug}/proposals` | Verified |
| My proposals | `GET /api/proposals` | Session |
| City's proposals | `GET /api/cities/{slug}/proposals` | Core team |
| Approve / reject a proposal | `POST /api/proposals/{id}` | Core team |
| Deploy a residency | Human signs on `/proposals/{id}` | Verified proposer |
| Apply to a residency | `POST /api/residencies/{address}/apply` | Verified |
| My application | `GET /api/residencies/{address}/apply` | Session |
| Pay for a bed | Human signs on `/r/{address}` | Approved applicant |
| Review applications | `GET /api/residencies/{address}/applications` | Host |
| Deny an applicant | `POST /api/residencies/{address}/applications/{id}` | Host |
| Approve / revoke an applicant | Human signs on `/r/{address}/manage` | Host |
| Withdraw, cancel, close | Human signs on `/r/{address}/manage` | Host |
| Receipts | `GET /api/residencies/{address}/receipts` | Host, stakers |
| Refund or leftovers | Human signs on `/r/{address}` | Staked member |
| List knowledge files | `GET /api/concierge/{city/slug \| residency/address}/knowledge` | Public |
| Read a file's text | `GET …/knowledge?file={filename}` | Public |
| Search knowledge | `GET /api/knowledge/search?q=&city=&residency=` | Public |
| Ask the concierge | `POST /api/concierge/{city/slug \| residency/address}` | Public |
| Write / upload / delete knowledge | `PUT` / `POST` / `DELETE …/knowledge` | City founder / residency host |
