# AI City — Dev Log

Engineering record of every feature shipped, newest first. Agents append an entry after each completed feature (rules in [`AGENTS.md`](AGENTS.md)).

This is the internal log. The public build journal at `/devlog` (`web/app/devlog/page.tsx`) is written separately for readers of the site.

---

## Current state — 2026-09-27

| Area | State |
|---|---|
| Contracts | `Residency.sol` + `ResidencyFactory.sol`. 30 Foundry tests (unit, fuzz, invariant, mainnet fork). Unaudited. |
| Deployment | **Sepolia only.** Factory `0x7A2E3f097Abd3c1a59D5a762f29d1f02E5A63f89`, mock USDC `0x0abd146eb01d8b923c2162489e006b7b01c77a57`, deploy block 11787037. Not on mainnet yet. |
| Web app | Next.js 16 in `web/`. City layer, proposals, residencies, directory, profiles, docs, blog, devlog, board, concierge, knowledge bases. Runs locally on port 3100. **Live (Sepolia)** at https://aicity.cyou on the shared droplet; sign-in works, verification doesn't yet (World ID not configured); deploy with `web/scripts/deploy-droplet.sh`. |
| E2E | `web/scripts/e2e-local.mjs` 53/53 and `web/scripts/e2e-agent.mjs` 40/40 (MCP + API keys), both passing 2026-09-27 against anvil. |
| Uncommitted | Pi 4 seat-key door (`pi4-door.py`, `aicity-door.service`, Zero `DOOR` command, `docs/pi4-door-kiosk-setup.md`). |

**Doc drift to fix:** `docs/master-plan.md` §4 says contracts are on mainnet and the app is on Vercel; neither is true yet. `docs/SECURITY.md` says 28 unit tests and 37 e2e checks; the latest counts are 30 contract tests and 53 e2e checks.

**Next up (from the README and master plan):** a World ID staging app for the live instance; then mainnet deploy with a hardware wallet, Neon + Vercel, 1 USDC smoke-test city, then the Edge City Goa scope (city vault, concierge agents, Reachy house robot, drone budget).

---

## 2026-09-27 — Agent access: API keys, MCP server, transaction prep; docs formatting
**Commit:** `e15eb42`, deployed to https://aicity.cyou (Sepolia) the same day

- **API keys.** `api_keys` table (`web/db/schema.sql`, sha256 of the key only). `lib/server/api-keys.ts`. `getAuth()` in `lib/server/session.ts` accepts `Authorization: Bearer aic_…` everywhere the cookie works; the header wins, and a bad key means signed out. `Me` gained `via: "session" | "key"`. `GET/POST /api/keys` and `DELETE /api/keys/[id]` use `requireCookieSession()`, so a key can't mint or revoke keys. Limit: 10 live keys. "Agent access" card on `/me`: create, copy once, revoke.
- **`POST /api/tx`** (`lib/server/tx.ts`): the calldata for every onchain button (`deploy_residency`, `approve_applicant`, `revoke_applicant`, `pay_for_bed` = USDC approve + stake, `withdraw`, `cancel`, `close`, `sweep`, `transfer_host`, `accept_host`, `claim`), plus the one-click `page` and what to record `after`. It checks role, status, balance and approved price first, so an agent gets the UI's error instead of a revert. Ids are coerced, since list endpoints return them as strings.
- **MCP server** `POST /api/mcp`: Streamable HTTP, stateless, JSON responses, hand-rolled JSON-RPC (`initialize`, `ping`, `tools/list`, `tools/call`, notifications → 202). There are 40 tools in `lib/server/mcp-tools.ts`, and each calls an existing route handler in-process with the outer request's auth, so MCP can't drift from HTTP. Files go in as base64. Requests from a different `Origin` get a 403.
- **Agent docs.** New `public/skills/mcp.md` and `transactions.md`. `skill.md` v2: three ways in, and an HTTP ↔ MCP tool ↔ access table. `auth.md` puts API keys first (cookie is the fallback). The task skills name their MCP tools and point own-wallet signing at `/api/tx`. There's a new "For agents" section on `/docs` (keys, MCP config, tool table, transactions, skill files). Plan: `docs/agent-access-plan.md`. `technical-architecture.md` §3.1/§4.7, `SECURITY.md` and README updated. New blog post `/blog/connect-your-agent` (key → Claude Code / MCP config / skill.md → example prompts → how signing works) and a quickstart at the top of `/docs#agents`.
- **Docs formatting fix.** `@tailwindcss/typography` was never installed, so every `prose` class was a no-op and Tailwind's reset removed all heading, paragraph and list spacing on `/docs`, `/docs/contracts`, `/blog/*` and `/devlog`. Installed it (`@plugin` in `globals.css`) and themed it to the palette: no backticks around inline code, a light `pre`, anchor scroll margin.
- **Verified:** `tsc --noEmit` clean. `pnpm lint` has 37 problems before and after, none in the new files. New `web/scripts/e2e-agent.mjs` **40/40** runs the whole lifecycle over MCP with keys: launch city → core team → propose → approve → prepare/sign/record deploy → apply → approve → pay (2 steps) → knowledge → withdraw + base64 receipt → close → claim → profile → revoke. The wallets only signed the steps `prepare_transaction` returned. `e2e-local.mjs` **53/53** still passes.
- **Known gaps:** `web/.env.local` currently points at Sepolia, so both e2e scripts were run against a second dev server with anvil env overrides. No key scopes yet (read-only etc.). The MCP server has no SSE stream or resources/prompts, only tools. The e2e runs added test cities (`agent-city-e2e*`) to the local database.

## 2026-09-27 — World ID: real Developer Portal config, staging verification token
**Commit:** uncommitted

- Developer Portal (team `synducer`, app `aicity` = `app_96e4b0f3b894f1035a3ee6a223f48cd7`, RP `rp_aaf593d897625e61`, registered in production and staging). Created the v4 action `ai-city-verify-human` in both environments; the app had none, so every verification would have failed with "action not found". Done through the portal MCP endpoint with the team API key.
- `web/.env.local`: real app ID replaces `app_staging_placeholder`; added `WORLD_RP_ID`; Konrad added `WORLD_RP_SIGNING_KEY`, whose derived address matches the registered signer `0xb437…6809`.
- Staging (simulator) proofs are refused with `environment_not_allowed` unless a portal staging window is open, and each verify call must carry its token. Opened a 24h window (`set_world_id_staging_verification`); `app/api/world/verify/route.ts` now sends `x-staging-verification-token` from `WORLD_STAGING_VERIFICATION_TOKEN`, only when `NEXT_PUBLIC_WORLD_ENV=staging`. Added the variable to `.env.example`.
- Verified against the local dev server: SIWE sign-in 200; `/api/world/rp-context` 200 with a signed context for the RP (5 min TTL); a fabricated proof reaches World and is rejected `all_verifications_failed` (was `environment_not_allowed` before the token); gated `POST /api/cities` while unverified 403. `tsc --noEmit` clean; eslint clean on the changed file (the 25 `pnpm lint` errors are in other files).
- **Not yet done:** no real simulator or World App proof has completed. e2e wasn't rerun cleanly: `.env.local` points at the Sepolia factory, so contract steps fail on anvil; the sign-in and verification checks passed. The droplet still has no World config.

## 2026-09-27 — Pi 4 seat-key door: Zero challenge signing, GPIO servo, keyboard-free SD card
**Commit:** uncommitted

- `web/hardware/pi4/pi4-door.py` + `aicity-door.service` + `door.env.example`: waits for the Pi Zero's USB gadget port (`/dev/serial/by-id/*Gadget*`, falling back to `/dev/ttyACM*`), sends a random 32-byte challenge, recovers the signer with `eth_account`, and opens the SG90 on GPIO 12 for `DOOR_OPEN_SECONDS`. It opens once per insertion. `DOOR_RULE` is `pair` (the first key enrolls, stored in `/var/lib/aicity-door/paired-address`), `staked` (`getMember().staked`) or `active` (plus `status()` Active and inside `startTime`/`endTime`). Chain reads are plain JSON-RPC `eth_call`, so the Pi doesn't need Foundry. The servo runs on hardware PWM0 through sysfs (`dtoverlay=pwm,pin=12,func=4`), not gpiozero's software PWM.
- `zero-tx-signer.py`: new `DOOR:<residency>:<challenge>` → `DOOR_SIG:<sig>` command. It signs a fixed EIP-191 message (`door_message()`, the same format as in `pi4-door.py`) after a strict regex check. The wallet that stakes through `cold-sign.py` is the same key that opens the door, and one daemon serves both.
- The Pi 4 SD card (boot partition) is set up for no keyboard. cloud-init `user-data` installs `/opt/aicity-door` (a venv with `--system-site-packages`, `eth-account`) and enables the service. `door.env` and `board-url.txt` are edited from the Mac. `instance-id` was bumped to `aicity-board-2026-09-27-door` so cloud-init runs again. The screen stays `piscreen,drm,rotate=0` (landscape).
- `docs/pi4-door-kiosk-setup.md`: how it fits together, the door rules, wiring, SSH checks.
- `docs/pi4-door-kiosk-setup.md` Test 6: a servo-only bench test over SSH (PWM overlay check, stop the service, `close`/`open`/`close`, `test` sweep, 10 cycles, undervoltage check, restart), with a fault table. Linked from `docs/test-checklist.md` 11.7. Run on the Pi 4 on 2026-09-27: 6.1–6.6 pass on the software side (PWM pulse 0.5/1.5 ms, 10/10 cycles, `throttled=0x0`); the physical movement was checked by eye at the desk. `secondBrain.local` doesn't resolve from the Mac, so SSH goes by IP (`arp -a`). Sudo needs a password, but the `gpio` group can drive `pwm0` without it.
- Verified on the Mac: the real `zero-tx-signer.py` and `pi4-door.py` talked over a pty pair. First key enrolled and opened, same key opened again, a different paired key was denied, a malformed `DOOR:` was refused (`ERR:BAD_DOOR_CHALLENGE`). A live Sepolia `eth_call` through `eth_call()` decoded mock USDC `totalSupply`. Publicnode returns 403 to urllib's default User-Agent, so the script now sends its own. **Not yet run on the Pi 4 or the Zero.**
- **Known gaps:** the board's residency `0xcafac3dd…052c` has no Sepolia contract, so `staked`/`active` fail until a Sepolia residency exists. Door events aren't shown on the screen. The older untracked `pi4-door-orc.py`, `seat-key-door.service` and `zero-door-program*.py` are superseded (Arduino, wrong ports) and left untouched.

## 2026-09-27 — Local database copied to the live instance; trigger search_path fix
**Commit:** `b7c0830`

- Copied the local Postgres data to the live instance at Konrad's request, as an exact copy: 3 users, 3 profiles, city `edge-city-goa`, 3 series, 3 proposals, 1 residency, 2 applications, 3 knowledge files. The knowledge chunks were rebuilt by the trigger. The server's previous data is backed up on the droplet under `/root/ai-city/backups/`.
- `knowledge_rechunk()` now pins its `search_path` (`SET search_path FROM CURRENT`, `web/db/schema.sql`). pg_dump output empties the search_path, so restoring any dump failed with `relation "knowledge_chunks" does not exist`. Migrated locally and on the server.
- **Known consequences of the exact copy:** (1) the 3 users are anvil's default accounts, whose private keys are public, and are marked verified. Anyone can sign in as them on the live site, including as founder of Edge City Goa. (2) Residency `0xcafac3dd…052c` exists only on local anvil, so on Sepolia it has no onchain state (`state: null`), and staking or approving there will fail. Replace these with real wallets and a Sepolia deployment before inviting anyone.

## 2026-09-27 — aicity.cyou domain + HTTPS
**Commit:** `42dfbb2` (server config; this entry)

- DNS at Namecheap (BasicDNS): `A @` and `A www` → the droplet. Nginx `ai-city.conf` now serves `aicity.cyou` and `www.aicity.cyou` only; the bare IP no longer serves AI City.
- Let's Encrypt certificate via `certbot --nginx --redirect` (both names, expires 2026-12-25, renewed by `certbot.timer`). HTTP redirects to HTTPS.
- Fixes the sign-in gap from the droplet deploy: session cookies are `Secure`, and now they stick. Verified: `https://aicity.cyou/` and `https://www.aicity.cyou/` 200, `http://` 301 to HTTPS, `/api/auth/nonce` sets its cookie over HTTPS, Argo API `/health` still 200.
- Still open: World ID is the staging placeholder, so nobody can verify, and writes stay blocked until a World ID staging app is configured.

## 2026-09-27 — Pi Zero offline transaction signer
**Commit:** uncommitted

- `web/hardware/pi-zero/zero-tx-signer.py`: an air-gapped signing daemon on `/dev/ttyGS0`. It generates a BIP-39 key on the first offline boot (`/var/lib/zero-signer/mnemonic`, 0600) and signs EIP-1559 transactions sent as `SIGN:<json>`. It enforces a policy set by `ZERO_CHAIN_IDS` (default Sepolia), `ZERO_MAX_VALUE_WEI` (0.05 ETH) and `ZERO_MAX_FEE_WEI` (0.02 ETH), and refuses contract creation. It decodes Residency, ResidencyFactory and ERC-20 calls by name with `eth_abi`. No command exports the key.
- `web/hardware/pi-zero/zero-tx-signer.service`: systemd unit with the venv at `/opt/zero-signer/venv`.
- `web/hardware/pi-zero/cold-sign.py` (Mac, `uv run`, pyserial only): gets the nonce, fees and gas over JSON-RPC and encodes calldata with `cast calldata`. It sends the transaction to the Zero, checks the signer address, then broadcasts and waits for the receipt. `addr` prints the address and balance; `--no-broadcast` signs only.
- `docs/pi-zero-offline-signer-setup.md`: install while online, then `disable-wifi`/`disable-bt` overlays and SSH off. The key is generated offline. The gadget loads via `/etc/modules-load.d` instead of `cmdline.txt`, and pip uses `--only-binary=:all:` so the Zero doesn't compile `pydantic-core`.
- Verified on the Mac against anvil through a virtual serial pair: `addr`, a 0.01 ETH transfer signed and mined, `stake(uint256)` decoded with `--no-broadcast`, a 0.5 ETH transfer refused by the cap. Not yet run on the Zero itself.
- **Known gaps:** no physical confirm button or screen, so the Mac's display is trusted (needed before mainnet). The seat-key `zero-signer.py` still opens `/dev/ttyAMA0`, and both signers want `/dev/ttyGS0`, so run one at a time.

## 2026-09-27 — Pi 4 + Arduino + servo + screen setup guide
**Commit:** uncommitted

- `docs/pi4-arduino-servo-screen-setup.md`: step-by-step build of the status board and latch from the parts in the cyberdeck inventory (Pi 4, 3.5" `piscreen,drm` display, Arduino Uno, SG90, 10-segment bar, MB102 for servo power).
- Corrects the older guides for the real hardware: the screen covers GPIO 1–26 so the Uno is USB-only; kiosk via desktop autostart, not `xinit`; venv with `pyserial-asyncio` + `eth-account` (the old prereqs missed both); a systemd unit with the right user, Sepolia RPC and Foundry on `PATH`.
- Documents that `/r/[address]/board` 404s unless the residency is in Postgres, and the live instance has no cities yet, so the board points at a local Sepolia dev server for now.
- Not changed, flagged for the Pi Zero step: `zero-signer.py` opens `/dev/ttyAMA0` (should be `/dev/ttyGS0`), and `pi4-orchestrator.py` expects the Zero at `/dev/ttyGS0` (the host sees it as `/dev/ttyACM*`).
- Verified: docs only; checked script pinouts against `web/hardware/`, and `GET /api/cities` on the live instance returned no cities.
- Added §0 to the guide: a display-only fast path (no Arduino, nothing copied to the Pi) and a table of ways to move files from the Mac (`scp`, `rsync`, `git clone` once the hardware scripts are pushed). §5.1 now starts the dev server with `--hostname <mac-lan-ip>`: Next 16 blocks dev assets for other hostnames, so the Pi would get the board's HTML without its JavaScript and polling. Production isn't an option because `/api/world/dev-verify` 404s there.
- Added `web/hardware/pi4/pi4-gpio-board.py` (`test` / `open` / `close` / `run`) and guide §6b for the no-Arduino path: 8-segment bar and SG90 on the free GPIO pins 27–40, servo powered from the breadboard power module. Verified with `py_compile` only; not yet run on the Pi.

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
