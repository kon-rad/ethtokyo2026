# AGENTS.md — AI City

Instructions for any coding agent (Claude Code, Codex, Hermes, etc.) working in this repo. This file is the top-level source of truth for the project. `CLAUDE.md` imports it.

## What this is

Luma for pop-up cities. Cities are offchain containers (Postgres). Inside a city, verified humans propose residencies; the city's core team approves; the proposer deploys a `Residency` contract that holds guests' USDC stakes, refunds if the minimum isn't reached, and lets the host withdraw against receipts. Full overview in [`README.md`](README.md).

**Unaudited contracts holding real money.** Treat any change under `contracts/src/` as security-sensitive.

## Read before working

| File | When |
|---|---|
| [`DEVLOG.md`](DEVLOG.md) | Always, first. Current state, deploy addresses, what shipped, what's next. |
| [`README.md`](README.md) | How it works, run locally, deploy, page map. |
| [`docs/technical-architecture.md`](docs/technical-architecture.md) | Data model, API routes, auth, deploy lifecycle. |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Before touching contracts, auth, receipts or World ID. |
| [`web/AGENTS.md`](web/AGENTS.md) | Before writing code in `web/`. Next.js 16 has breaking changes; read `web/node_modules/next/dist/docs/` for the API you use. |

## Repo map

```
contracts/   Foundry: src/Residency.sol, src/ResidencyFactory.sol, test/, script/
web/         Next.js 16: app/ (pages + API routes), lib/, components/, db/schema.sql, scripts/, public/skills/
docs/        plans, architecture, security, hardware guides
DEVLOG.md    feature log — update after every feature
```

## Working rules

- **The database follows the chain, never leads.** Record onchain actions in Postgres only after reading the mined transaction's event.
- **Humans sign every wallet action.** Agent skills in `web/public/skills/` prepare transactions and hand off; they never hold keys.
- After changing a contract: `cd contracts && forge build && forge test`, then `node web/scripts/gen-abi.mjs`.
- After changing the schema: edit `web/db/schema.sql` and run `node web/scripts/migrate.mjs`.
- Before calling a feature done: `forge test` for contract changes, `pnpm lint` and `pnpm exec tsc --noEmit` in `web/`, and `node web/scripts/e2e-local.mjs` for anything touching flows (needs anvil + local deploy + `pnpm dev --port 3100`).
- If you add a page, API route or agent skill, update the tables in `README.md` and, for agent-facing behaviour, `web/public/skill.md`.
- Never commit `.env*` files or print their values. Never broadcast to mainnet without Konrad's explicit go-ahead.

## Dev log: required after every feature

**After completing each feature, fix or meaningful change, add an entry to [`DEVLOG.md`](DEVLOG.md) before you report the work as done.** A feature isn't finished until its devlog entry exists.

1. Add the entry at the top of the log (below the "Current state" block), newest first.
2. Update the "Current state" table if the feature changed deploy addresses, test counts, e2e counts, or what's uncommitted. Remove "Doc drift" or "Next up" items you resolved.
3. Include the commit hash once committed; if not committed yet, write `uncommitted` and fill it in when it is.

Entry format:

```markdown
## YYYY-MM-DD — Short feature name
**Commit:** `abc1234`

- What was built, in concrete terms (routes, contract functions, tables, components).
- Why, if the reason isn't obvious.
- How it was verified: tests run and their counts (e.g. `forge test` 30/30, e2e 53/53).
- Follow-ups or known gaps.
```

Use absolute dates. Be specific: name files, functions and routes. Don't log chores (formatting, lockfile bumps) as their own entries; fold them into the feature they served.

The public `/devlog` page (`web/app/devlog/page.tsx`) is separate reader-facing copy. Don't edit it unless asked.
