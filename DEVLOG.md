# AI City — Dev Log

Engineering record of every feature shipped, newest first. Agents append an entry after each completed feature (rules in [`AGENTS.md`](AGENTS.md)).

This is the internal log. The public build journal at `/devlog` (`web/app/devlog/page.tsx`) is written separately for readers of the site.

---

## Current state — 2026-09-27

| Area | State |
|---|---|
| Contracts | `Residency.sol` + `ResidencyFactory.sol`. 30 Foundry tests (unit, fuzz, invariant, mainnet fork). Unaudited. |
| Deployment | **Sepolia only.** Factory `0x7A2E3f097Abd3c1a59D5a762f29d1f02E5A63f89`, mock USDC `0x0abd146eb01d8b923c2162489e006b7b01c77a57`, deploy block 11787037. Not on mainnet yet. |
| Web app | Next.js 16 in `web/`. City layer, proposals, residencies, directory, profiles, docs, blog, devlog, board, concierge, knowledge bases. Runs locally on port 3100. **Live (Sepolia, read-only)** on the shared droplet's IP over HTTP; deploy with `web/scripts/deploy-droplet.sh`. |
| E2E | `web/scripts/e2e-local.mjs`, 53/53 passing as of `d61ea87`. |
| Uncommitted | `contracts/script/DeploySepolia.s.sol`: mints test USDC to the real broadcaster (`vm.readCallers()`) instead of Foundry's default sender. |

**Doc drift to fix:** `docs/master-plan.md` §4 says contracts are on mainnet and the app is on Vercel; neither is true yet. `docs/SECURITY.md` says 28 unit tests and 37 e2e checks; the latest counts are 30 contract tests and 53 e2e checks.

**Next up (from the README and master plan):** a domain + TLS for the droplet instance so sign-in works, and a World ID staging app; then mainnet deploy with a hardware wallet, Neon + Vercel, 1 USDC smoke-test city, then the Edge City Goa scope (city vault, concierge agents, Reachy house robot, drone budget).

---

## 2026-09-27 — Live Sepolia instance on the shared droplet
**Commit:** deployed `167e5d9`; deploy script added in the commit after it

- Deployed the web app to the shared DigitalOcean droplet that hosts the Argo web app (host and SSH key in Konrad's private notes, not this public repo). PM2 process `ai-city-web` on `127.0.0.1:3300`, 450 MB memory cap; nginx server block `/etc/nginx/sites-available/ai-city.conf` serving it on the droplet's IP over plain HTTP.
- Own Postgres role and database `ai_city` on the droplet's Postgres 15. `migrate.mjs` applied (11 tables), `import-knowledge.mjs` loaded the 3 seed files.
- Configured for Sepolia: factory `0x7A2E…3F89`, mock USDC `0x0abd…7a57`, deploy block 11787037. Server-owned `/root/ai-city/web/.env.local` (session secret and DB password generated on the server).
- `web/scripts/deploy-droplet.sh`: builds `HEAD` locally (a Next.js build can exhaust the shared droplet's memory), rsyncs, installs prod deps with `--ignore-scripts` (the `postinstall` patch-commit hook fails on a fresh install), migrates, restarts. Host and key come from `AICITY_DEPLOY_SERVER` / `AICITY_DEPLOY_SSH_KEY`.
- Verified: `/`, `/cities`, `/people`, `/skill.md`, `/skills/*.md`, `/api/cities`, `/api/knowledge/search` return 200 over the public IP; the other sites on the droplet and the Argo API `/health` still return 200.
- **Known gaps:** (1) Sign-in doesn't work over plain HTTP: session cookies are `Secure` in production, so browsers drop them. It needs a domain + TLS (certbot). (2) World ID is the staging placeholder and `ALLOW_DEV_VERIFY` is off in production, so no one can verify. The live instance is read-only until both are set up. (3) The `penang-2026` seed knowledge has no matching city row.

## 2026-09-27 — Knowledge bases in Postgres; agent skills hand off signing
**Commit:** `167e5d9`

- `knowledge_files` + `knowledge_chunks` tables with Postgres full-text search (`web/db/schema.sql`).
- `/api/knowledge` routes plus `GET /api/knowledge/search`; PDF and DOCX text extraction via `unpdf` and `mammoth` (`web/lib/concierge/extract.ts`).
- City founder or residency host writes markdown or uploads files through `knowledge-manager.tsx` / `knowledge-editor.tsx`. A residency's concierge also reads its city's files.
- `web/scripts/import-knowledge.mjs` loads the seed files in `web/knowledge/`.
- Agent skills now say the human signs every wallet action: agents prepare and hand off. `apply-residency.md` documents `stake(price)` and the 180-day claim window.

## 2026-09-27 — Contract hardening: price-guarded stake, host transfer, sweep
**Commit:** `d61ea87`

- `stake(expectedPrice)` reverts with `PriceChanged` if the host re-approved the member at a different price, so a front-run can't charge more than agreed.
- Two-step host transfer: `transferHost` → `acceptHost`. New `POST /api/residencies/[address]/host` syncs the host from the chain.
- `sweep()`: host collects unclaimed leftovers 180 days after close. Failed residencies are never sweepable.
- 6 new contract tests (30 total).
- UI: host handover and sweep cards on `/r/[address]/manage`, "Accept host role" on the residency page.
- New `/docs/contracts` function-by-function reference; `SECURITY.md` and `/docs` corrected.
- Pi seat-key guide and hardware scripts retargeted from `PopupCity` to `Residency` (`seatCount`, `getMember`, `status`, dates).
- e2e: fixed request helper, min seats and status comparison; added price-guard, host-transfer and docs checks. **53/53 pass.**

## 2026-09-26 — Residency status board, docs site, blog, concierge, agent skills
**Commit:** `e7a9dc9`

- `/r/[address]/board`: full-screen read-only board for a 480×320 SPI display. Live status pill, seats bar with minimum marker, deadline countdown, USDC held/staked/withdrawn, recent stake and withdrawal feed. Polls chain every 15 s, events every 30 s, receipts every 60 s.
- `docs/pi-status-board-setup.md`: flash, SPI screen, Chromium kiosk, boot persistence.
- Hardware code: `web/hardware/arduino/seat-key-controller.ino`, `pi-zero/zero-signer.py`, `pi4/pi4-orchestrator.py` + systemd unit.
- Self-hosted `/docs` page, `/blog` index, public `/devlog` page.
- Concierge v1: `concierge-panel.tsx`, `lib/concierge/chat-together.ts` (Together AI), file-based knowledge (replaced by Postgres in `167e5d9`). Seed knowledge for `penang-2026`.
- Agent skills: `web/public/skill.md` index plus `skills/` for auth, directory, launch-city, launch-residency, apply-residency, knowledge.

## 2026-09-26 — Planning docs
**Commit:** `1be1100`

- `docs/master-plan.md`: mission, core concepts, user flows, extropian framing, roadmap.
- `docs/technical-architecture.md`: contracts, data model, API routes, auth flow, deploy lifecycle, security model.
- `docs/hardware-integrations.md`: 17 hardware projects ranked by feasibility, from the status board to the house robot and drone budget.

## 2026-09-26 — Sepolia support
**Commit:** `9c5b220`

- `web/lib/config.ts` recognises `NEXT_PUBLIC_CHAIN_ID=11155111`.
- `contracts/script/DeploySepolia.s.sol` deploys a mock USDC and the factory. Broadcast dirs for Sepolia and mainnet gitignored.
- Deployed to Sepolia (addresses in Current state above).

## 2026-09-26 — City layer: all pages
**Commit:** `05ba35a`

- New pages: `/launch`, `/cities`, `/cities/new` (redirect), `/cities/[slug]`, `/cities/[slug]/manage`, `/cities/[slug]/propose`, `/proposals/[id]`, `/series/[slug]`, `/people`, `/people/[address]`, `/me`.
- Residency view links to its city and series.
- `e2e-local.mjs` and `seed-local.mjs` rewritten for the city flow: launch city → core team → propose → approve → deploy → apply → stake → withdraw → close → claim.
- README and `architecture-plan.md` updated for the two-layer model.

## 2026-09-26 — Rename to Residency; city layer API, profiles, directory
**Commit:** `26199d4`

- Contracts renamed `PopupCity` → `Residency`, factory → `ResidencyFactory`. Logic unchanged, 25/25 tests pass.
- Residency routes moved from `/c` to `/r` and `/api/residencies`.
- Schema extended: cities, core team, residency series, proposals, profiles.
- Server modules: `lib/server/cities.ts`, `proposals.ts`, `residencies.ts`, `profiles.ts`. Series, directory and profile APIs, visibility toggle.
- Components: `residency-card`, `residency-grid`, `person`, `directory`, infinite scroll hook.

## 2026-09-26 — Initial build: contracts, app, World ID
**Commit:** `9d36013`

- Factory + per-city contracts: approve bed, stake, refund if minimum not reached, withdraw against receipts, pro-rata close. Unit, fuzz, invariant and mainnet-fork tests.
- Foundry libs as submodules pinned to forge-std v1.16.2 and OpenZeppelin v5.7.0.
- Next.js app: SIWE sessions (jose-signed cookies), World ID Proof of Human via IDKit 4.x with server-side RP signing, one nullifier per wallet, self-attested 18+.
- Launch / apply / approve / stake flows, receipt storage with sha256 check.
- Scripts: `migrate.mjs`, `gen-abi.mjs`, `seed-local.mjs`, `e2e-local.mjs`.
- Debrief: `docs/WORLD-IDKIT-DEBRIEF.md`.
