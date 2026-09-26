---
name: ai-city
description: Act on AI City for your human. Search the people directory, browse cities and residencies, launch a pop-up city, propose and launch a residency, apply to a residency and pay for a bed, and query each city's and residency's knowledge base. Everything a person can do in the UI, over HTTP and onchain calls.
version: 1
---

# AI City: agent skill

AI City is Luma for pop-up cities. A **city** is a place and a time window, stored offchain. Inside a city, verified humans **propose residencies** (dates, rooms, per-bed prices in USDC). The city's **core team** approves a proposal, then the proposer **deploys** it as its own `Residency` contract on Ethereum. Guests **apply**, the host **approves** each guest for a bed onchain, and guests **stake** USDC. If the minimum number of seats isn't reached by the deadline, everyone gets a refund.

You act as your human's wallet. Everything the UI does goes through the API below, and the UI adds nothing an agent can't do.

## Skill files

Fetch the one you need. Paths are relative to the site you are talking to.

| File | Use it to |
|---|---|
| [`/skills/auth.md`](skills/auth.md) | Sign in (SIWE), check verification, handle the session cookie. **Read this first.** |
| [`/skills/directory.md`](skills/directory.md) | Search people, browse cities, residencies and series, read and edit your human's profile |
| [`/skills/launch-city.md`](skills/launch-city.md) | Launch a city, edit it, manage its core team, review residency proposals, hide residencies |
| [`/skills/launch-residency.md`](skills/launch-residency.md) | Apply to a city by proposing a residency, deploy it once approved, then run it as host |
| [`/skills/apply-residency.md`](skills/apply-residency.md) | Apply to a residency, track the application, stake USDC for the bed, claim refunds |
| [`/skills/knowledge.md`](skills/knowledge.md) | List and query a city's or residency's knowledge base through its concierge, and add files to it |

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

1. **Ask before anything that spends money or makes a commitment.** That means every onchain transaction (`createResidency`, `approve`, `stake`, `withdraw`, `close`, `cancel`) and every submission other people will see (launching a city, submitting a proposal or an application, approving or rejecting someone). Show your human exactly what you'll send, then send it.
2. **Never invent your human's details.** Name, bio, links, dates and prices come from them. If a required field is missing, ask.
3. **Read before you write.** Fetch the city or residency first: dates, deadline, status and bed prices decide what's valid.
4. **Onchain first, API second.** For anything recorded onchain, send the transaction, wait for the receipt, then report its `txHash` to the API. The server re-reads the chain and rejects anything that doesn't match.
5. **The contracts are unaudited.** Say so before your human stakes, and don't stake more than they told you to.

## Everything at a glance

| Action | Call | Access |
|---|---|---|
| Sign in | `GET /api/auth/nonce` → `POST /api/auth/verify` | Public |
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
| Deploy a residency | `ResidencyFactory.createResidency` → `POST /api/residencies` | Verified proposer |
| Apply to a residency | `POST /api/residencies/{address}/apply` | Verified |
| My application | `GET /api/residencies/{address}/apply` | Session |
| Pay for a bed | `USDC.approve` → `Residency.stake()` | Approved applicant |
| Review applications | `GET /api/residencies/{address}/applications` | Host |
| Approve / deny / revoke | `Residency.approve` → `POST /api/residencies/{address}/applications/{id}` | Host |
| Withdraw with receipt | `Residency.withdraw` → `POST /api/residencies/{address}/receipts` | Host |
| Refund or leftovers | `Residency.claim()` | Staked member |
| Knowledge files | `GET /api/concierge/{city/slug \| residency/address}/knowledge` | Public |
| Ask the concierge | `POST /api/concierge/{city/slug \| residency/address}` | Public |
