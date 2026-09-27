---
name: ai-city-mcp
description: Connect an agent to AI City's MCP server and use its 43 tools to launch cities, propose and run residencies, apply to them, and manage profiles and knowledge bases, with an API key your human creates. The human signs every transaction.
---

# AI City: MCP server

Part of the [AI City skill](../skill.md). Every tool here maps to one HTTP route and runs the same code, so the rules and error messages in the other skill files apply unchanged.

## Connect

| | |
|---|---|
| Endpoint | `<BASE>/api/mcp` |
| Transport | Streamable HTTP, stateless. `POST` only, and every response is plain JSON (no SSE stream). |
| Auth | `Authorization: Bearer aic_…`, an API key your human creates at `<BASE>/me` → **Agent access** ([auth.md](auth.md)) |
| Protocol versions | `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` |

Public tools (browsing cities, residencies, people, knowledge) work without a key. The rest return `Error 401: Sign in with your wallet first` until you send one.

### Claude Code

```bash
claude mcp add --transport http ai-city https://aicity.cyou/api/mcp \
  --header "Authorization: Bearer $AICITY_API_KEY"
```

### Claude Desktop, Cursor, and other clients that take a JSON config

```json
{
  "mcpServers": {
    "ai-city": {
      "type": "http",
      "url": "https://aicity.cyou/api/mcp",
      "headers": { "Authorization": "Bearer aic_…" }
    }
  }
}
```

Keep the key in an environment variable or your client's secret store, not in a file you commit. For a local stack, use `http://localhost:3100/api/mcp`.

### Raw JSON-RPC (any language)

```bash
curl -s https://aicity.cyou/api/mcp \
  -H 'content-type: application/json' -H "authorization: Bearer $AICITY_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami","arguments":{}}}'
```

## How results come back

- **Success:** `structuredContent` is the route's JSON response, and `content[0].text` is the same thing pretty-printed.
- **Failure:** `isError: true`, and `content[0].text` is `Error <status>: <message>`. The message is written for your human, so show it to them as is.

| Status | Meaning | What to do |
|---|---|---|
| 401 | No key, or a revoked one | Ask your human for a new key |
| 403 `Verify you're a human over 18 first` | The wallet hasn't done World ID | Send your human to `<BASE>/verify` |
| 403 (other) | Wrong role (not core team, host, proposer) | Tell your human who can do it |
| 400 / 409 | Invalid input or state (dates, deadline passed, already reviewed) | Fix the input from the message, or report it |

## Tools

**Access:** *Public* works with no key. *Key* needs any valid key. *Verified* means the key's wallet has passed World ID and 18+. *Role* names the role the key's wallet must hold.

### Account and profile

| Tool | Does | Access |
|---|---|---|
| `whoami` | The wallet the key acts as: `address`, `verified`, `adult`, `name`, `via` | Public (`me: null` without a key) |
| `get_my_profile` | Your human's directory profile, or null | Key |
| `update_my_profile` | Create or replace it: `name`, `bio`, `links`, `listed` | Verified |
| `set_my_profile_photo` | Upload a photo: `filename`, `mimeType`, `base64` (PNG/JPEG/WebP, < 2 MB) | Key |
| `remove_my_profile_photo` | Delete it | Key |

### Directory

| Tool | Does | Access |
|---|---|---|
| `search_people` | Search by name and bio; `city` narrows to one city | Public |
| `get_person` | Profile and participation (cities, residencies) by `address` | Public |

### Cities

| Tool | Does | Access |
|---|---|---|
| `list_cities` | Cities that haven't ended, soonest first | Public |
| `get_city` | Details, core team, and `myRole` | Public |
| `launch_city` | `name`, `location`, `mission`, `description`, `startTime`, `endTime`. Your human becomes the founder | Verified |
| `update_city` | Replace a city's details (send every field) | Core team |
| `add_core_team_member` | `slug`, `address` | Core team |
| `remove_core_team_member` | `slug`, `address` | Founder |
| `list_city_proposals` | Every residency proposed into the city | Core team |
| `review_proposal` | `id`, `decision` (`approve` / `reject`), `note` | Core team |
| `set_residency_visibility` | Hide a residency from the city (`hidden`, public `note`) or show it again | Core team |

### Proposing and running a residency

| Tool | Does | Access |
|---|---|---|
| `propose_residency` | Apply to a city: `citySlug`, dates, deadline, `rooms` with per-bed USDC prices, `organizers`, `minSeats`, `maxSeats`, `series` | Verified |
| `list_my_proposals` | Your human's proposals and their status | Key |
| `get_proposal` | One proposal, including what will be deployed | Proposer, core team |
| `list_my_series` / `get_series` | Residency series (recurring brands) | Key / Public |
| `record_residency_deploy` | After the deploy transaction: `proposalId`, `txHash` | Verified proposer |
| `list_applications` | Everyone who applied | Host |
| `deny_application` | Deny a pending application (no transaction) | Host |
| `record_application_decision` | After an approve or revoke transaction: `applicationId`, `action`, `txHash` | Host |
| `upload_receipt` | After a withdraw transaction: the receipt file (base64) and `txHash` | Host |
| `sync_residency_host` | After a host transfer is accepted onchain | Public |

### Applying to a residency

| Tool | Does | Access |
|---|---|---|
| `list_residencies` | Open and running residencies; filter by `city`, `series`; `all` for past ones | Public |
| `get_residency` | Rooms, bed ids and prices, dates, deadline, seats, onchain status | Public |
| `apply_to_residency` | `address`, `name`, `bio`, `links`, `preferredBedId` | Verified |
| `get_my_application` | Status, and once approved the bed and price | Key |
| `list_receipts` | Receipts behind the host's withdrawals | Host, paid guests |

### Transactions

| Tool | Does | Access |
|---|---|---|
| `prepare_transaction` | The exact transactions for any onchain action, for your human to sign. See [transactions.md](transactions.md) | Key, plus the action's role |

### Knowledge and concierge

`scope` is `city` or `residency`. `key` is the city slug or the residency address.

| Tool | Does | Access |
|---|---|---|
| `list_knowledge` | Files in a knowledge base, and `canEdit` | Public |
| `read_knowledge_file` | One file's text (PDF and Word come back as extracted text) | Public |
| `search_knowledge` | Full-text search across a residency, a city, or everything | Public |
| `ask_concierge` | Ask the concierge; it answers from the knowledge base and cites sources | Public |
| `write_knowledge_file` | Create or replace a markdown/text file | City founder, residency host |
| `upload_knowledge_file` | Upload PDF, DOCX, markdown or text (base64) | City founder, residency host |
| `delete_knowledge_file` | Delete a file | City founder, residency host |

### Argo private journal

| Tool | Does | Access |
|---|---|---|
| `link_argo_journal` | Link your human's Argo `@username` or wallet. Nothing is shared at link time | Verified |
| `ask_my_argo_journal` | `{ scope, key, questions? }`: that concierge sends questions (default: four matchmaking ones) to your human's Argo. They answer in Argo; approved answers feed the concierge's introductions. 3 a day per person | Verified |
| `list_my_argo_requests` | Requests, `pending` or `answered`, with the answers | Key |

## The three flows, as tool calls

**Launch a city.** `whoami` (check `verified`) → confirm the details with your human → `launch_city` → optionally `add_core_team_member` → `write_knowledge_file` for the city's practical info.

**Launch a residency.** `get_city` (read its dates) → `propose_residency` → wait for the core team (`list_my_proposals`) → `prepare_transaction {deploy_residency}` → human signs → `record_residency_deploy` → as host: `list_applications` → `prepare_transaction {approve_applicant}` → human signs → `record_application_decision`.

**Apply to a residency.** `list_residencies` / `get_residency` → confirm the bed and price with your human → `apply_to_residency` → poll `get_my_application` until `approved` → `prepare_transaction {pay_for_bed}` → human signs both steps → `get_residency` to confirm the seat.

What agents can't do, on purpose: sign in, create API keys, pass World ID, or sign transactions. Those are your human's.
