# Agent access: API keys, MCP server, skills

**Written:** 2026-09-27
**Goal:** Anything a person can do in the AI City UI, their agent can do too, over plain HTTP, over MCP, or by following the skill files. The human still signs every wallet action.

---

## Where it stood

| Surface | State before this work |
|---|---|
| HTTP API | Covered every offchain action already (cities, core team, proposals, applications, profiles, knowledge, concierge). |
| Auth for agents | Only the `aic_session` browser cookie. The human had to copy it out of DevTools, and it can't be revoked. |
| Onchain actions | Agents had no calldata. The only option was sending the human to a page. |
| MCP | None. |
| Skills | `/skill.md` plus six task files in `web/public/skills/`, all using cookie auth. |

## Design

### 1. API keys

- Table `api_keys`: `id`, `address`, `name`, `prefix` (first 12 chars, shown in the UI), `key_hash` (sha256 of the full key, unique), `created_at`, `last_used_at`, `revoked_at`.
- Key format `aic_` + 32 random bytes, base64url. The key is shown once at creation, and only its hash is stored.
- `Authorization: Bearer aic_…` is accepted everywhere the session cookie is (`getSessionAddress()` checks the header first). A key acts with the full rights of its wallet, including the World ID check, so there's one permission model, not two.
- **Keys can't manage keys.** `GET/POST /api/keys` and `DELETE /api/keys/{id}` require the cookie session. A leaked key can't mint more keys or hide itself.
- Limits: at most 10 active keys per wallet. `last_used_at` is written at most once a minute per key.
- UI: an "Agent access" card on `/me` to create a key (name, copy-once display), list keys (prefix, created, last used), and revoke one.

**Trade-off:** a key is as strong as a 7-day session but lasts until it's revoked. Keys never move money, because transactions need the wallet, so a revocable long-lived key is worth that risk. We don't have scopes yet (read-only keys and so on); that can come later if people ask.

### 2. Transaction preparation: `POST /api/tx`

Takes an action and its arguments, reads the current state, and returns the exact transactions for the human to sign:

```json
{ "chainId": 11155111, "page": "https://aicity.cyou/r/0x…",
  "steps": [{ "to": "0x…", "data": "0x…", "value": "0", "function": "stake(uint256)", "args": ["200000000"], "summary": "Stake 200 USDC for bed 3" }],
  "after": "Nothing to report: the chain is the record." }
```

Actions: `deploy_residency`, `approve_applicant`, `revoke_applicant`, `pay_for_bed` (USDC `approve` + `stake`), `withdraw`, `cancel`, `close`, `sweep`, `transfer_host`, `accept_host`, `claim`. Each one checks the caller's role first, so it fails early with the same error message the UI would show. `after` says which call records the result (`POST /api/residencies`, `POST …/applications/{id}`, `POST …/receipts`, `POST …/host`).

The human either opens `page` and clicks, or signs `steps` in their own wallet tool. Agents never sign.

### 3. MCP server: `POST /api/mcp`

- Streamable HTTP transport, stateless, JSON responses (no SSE). Handles `initialize`, `ping`, `tools/list`, `tools/call`, and notifications.
- Auth: the same `Authorization: Bearer aic_…` header. Public tools work without it.
- Each tool is a thin mapping onto an HTTP route. The route handler is called in-process, so MCP and HTTP can't drift apart: same validation, same errors, same permission checks.
- Files (knowledge uploads, receipts, profile photo) go in as base64.
- Tool errors come back as `isError: true` with the API's human-readable message.

### 4. Skills and docs

- `/skill.md` + `skills/auth.md`: API keys become the default auth, with the cookie kept as a fallback.
- New `skills/mcp.md`: connection config for Claude Code / Claude Desktop / Cursor, plus the full tool list.
- New `skills/transactions.md`: `POST /api/tx`, every action, and the prepare → sign → record → verify loop.
- `/docs`: new "Agents" section (API keys, MCP, skills, what agents can't do).
- The task skills (launch-city, launch-residency, apply-residency) each point at the `/api/tx` action for their onchain steps.

## What agents still can't do, on purpose

| Action | Why | What the agent does |
|---|---|---|
| Sign in / create an API key | Proves wallet ownership | Human signs in on the site and creates the key |
| World ID verification | Proves a unique human | Sends the human to `/verify` |
| Sign any transaction | Moves money | `POST /api/tx`, then hands off |

## Verification plan

- `pnpm exec tsc --noEmit`, `pnpm lint`.
- e2e additions in `scripts/e2e-local.mjs`: create a key with the cookie; call `/api/me` with the key; confirm keys can't list or create keys; MCP `initialize`, `tools/list`, public and authed `tools/call`; `POST /api/tx` for `pay_for_bed`; revoke and confirm a 401.
