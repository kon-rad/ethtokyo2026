# AI City — Dev Log

Engineering record of every feature shipped, newest first. Agents append an entry after each completed feature (rules in [`AGENTS.md`](AGENTS.md)).

This is the internal log. The public build journal at `/devlog` (`web/app/devlog/page.tsx`) is written separately for readers of the site.

---

## Current state — 2026-09-27

| Area | State |
|---|---|
| Contracts | `Residency.sol` + `ResidencyFactory.sol`. 30 Foundry tests (unit, fuzz, invariant, mainnet fork). Unaudited. |
| Deployment | **Ethereum mainnet** since 2026-09-27: factory `0x0Abd146EB01d8b923C2162489E006b7b01C77A57`, block 26064603, real USDC `0xA0b8…eB48`, deployer `0xff7b…7E64` (the Sepolia keystore; the factory has no owner). Not source-verified yet. Old Sepolia: factory `0x7A2E3f097Abd3c1a59D5a762f29d1f02E5A63f89`, mock USDC at the same address as the mainnet factory (same deployer, nonce 0), block 11787037. |
| Web app | Next.js 16 in `web/`. City layer, proposals, residencies, directory, profiles, docs, blog, devlog, board, concierge, knowledge bases. Runs locally on port 3100. **Live (mainnet)** at https://aicity.cyou on the shared droplet. |
| E2E | `web/scripts/e2e-local.mjs` 53/53 and `web/scripts/e2e-agent.mjs` 40/40 (MCP + API keys), both passing 2026-09-27 against anvil. |
| Uncommitted | Faster seat key + door banner (2026-09-27 entry): not committed, not deployed, not yet on the Zero or Pi 4 cards. Argo journal link + README/docs/blog (2026-09-27 entries): not committed, not deployed; the droplet needs `ARGO_AGENT_PRIVATE_KEY`, `ARGO_WEBHOOK_URL` and the migration. |
| Blog | 4 posts: infomorph-extropianism (vision), connect-your-agent (guide), ai-city-app (product + philosophy), argo-journal-concierge (Argo journal link). |

**Next up:** World ID for the live instance, the 1 USDC smoke-test city on mainnet, source verification, Edge City Goa scope (city vault, concierge agents, Reachy house robot, drone budget).

---

## 2026-09-27 — Argo journal link: concierge asks your Argo journal, answers feed matchmaking
**Commit:** uncommitted

- Built on Argo's agent info-request protocol, already live on `api.luminalog.com` (luminalog-oss `server/src/routes/inbox.ts`, ADR-0161): EIP-191 signed `POST /v1/inbox/requests`, answered in the iOS Inbox (1.0.2), delivered to our webhook signed by Argo's server key (`GET /v1/inbox/signer`, currently `0x03ce…7bEb`).
- Schema (`web/db/schema.sql`): `argo_links` (address → `@username` or 0x) and `argo_requests` (Argo's request id = sha256 of the canonical payload, scope, questions, status, answers).
- `web/lib/server/argo.ts`: handle normalisation (Argo's `[a-z0-9_]{3,20}`), canonical payload + signing with `ARGO_AGENT_PRIVATE_KEY` (dedicated key; local dev address `0xb017…3Ab9`), Argo error codes mapped to readable messages, webhook verification over the raw body against the pinned signer (`ARGO_SIGNER_ADDRESS` overrides for tests), `argoNotes()`: answered, non-declined answers for a residency + its city, or a city + all its residencies.
- Routes: `GET/PUT/DELETE /api/argo/link`, `GET/POST /api/argo/requests`, `DELETE /api/argo/requests/[id]`, `POST /api/argo/webhook`. Linking and asking need World ID (only verified wallets have a `users` row, and an unverified link hit its foreign key).
- Concierge (`lib/concierge/knowledge.ts`): member notes appended to the prompt with an instruction to suggest introductions and say why; `knowledgeSources` gains `argo · member notes`. `ConciergePanel`: **Ask my Argo journal** button for signed-in users (sends the four default questions), with a link to `/me` if not linked. `/me`: `ArgoJournal` card (link/unlink, requests with answers, remove from concierge).
- MCP: `link_argo_journal`, `ask_my_argo_journal`, `list_my_argo_requests` (43 tools). Skill docs: `skill.md`, `skills/mcp.md`, `skills/knowledge.md`. README §8, `/docs#argo-journal`, the blog post and the landing section now describe the live feature; `.env.example` has the three `ARGO_*` vars.
- **Privacy trade-off, stated in the request's reason text and the docs:** the concierge chat is public, so approved answers can be repeated to anyone who asks it. Argo rate-limits the concierge to 3 requests a day per person.
- Verified: `tsc --noEmit` clean; eslint clean on new files (existing errors in two older blog posts and `me/page.tsx:48` untouched). `node web/scripts/e2e-argo.mjs` 10/10 against the **real Argo API** (it accepted our signature and canonical payload, then 404'd the deliberately nonexistent `@zz_nobody_e2e`, so no inbox was touched), and `--webhook` 16/16 with a test signer: tampered body 401, signed delivery stored, redelivery idempotent, declined kept declined, the city concierge (Together) suggested the test member from their answer, removal takes it out. MCP `tools/list` returns 43 with the three Argo tools. The UI wasn't clicked through in a browser (it needs a wallet sign-in); pages return 200.
- **To go live:** commit, run the migration on the droplet, set `ARGO_AGENT_PRIVATE_KEY` (new key) and `ARGO_WEBHOOK_URL=https://aicity.cyou/api/argo/webhook`, redeploy. A real round trip needs an Argo username (Settings → Username, iOS 1.0.2, in TestFlight, not on the App Store yet).

## 2026-09-27 — README feature rundown, Argo journal link (docs, blog, landing), credit line
**Commit:** uncommitted

- `README.md`: new **Features** section covering launching a city; residency proposals approved or rejected by the city's founder/core team; guests approved or denied by the host, then staking; the contract's withdraw rule (Failed → refunds, Active once `minSeats` paid → withdraw against receipts, Closed → pro-rata); the air-gapped Pi Zero seat key and door rules as the agent-first proof of concept; the Pi 4 house board; concierge + knowledge bases (residency reads its city's files) and the MCP knowledge tools; the Argo journal link. Pages table gains `/blog/argo-journal-concierge`. Ends with "A Konrad Gnat production. Founder, Argo."
- `README.md`: **Demo video** section under the live link (YouTube thumbnail linking to https://www.youtube.com/watch?v=LqMwDiv1P_w), and the screen-recordings table now points to it as the full walkthrough.
- `/docs` (`web/app/docs/page.tsx`): new "Concierge and Argo" section: `#concierge`, `#knowledge-bases` (scope table + MCP tools), `#argo-journal` (link → request → approve → match, and a sees / never-sees table).
- `/blog/argo-journal-concierge` (new) and the blog index entry. Landing page (`web/app/page.tsx`): an Argo section above People linking to the post and the docs.
- Footer (`web/components/footer.tsx`): "A Konrad Gnat production · Founder, Argo" linking to myargoquest.com.
- The Argo link was copy-only at this point; built in the entry above.
- Verified: `tsc --noEmit` clean; eslint on the changed files shows only the two existing unused-import warnings in `docs/page.tsx`. `/`, `/docs`, `/blog`, `/blog/argo-journal-concierge` return 200 on the local dev server with the new copy. Not deployed.

## 2026-09-27 — Faster seat key, door banner on the board
**Commit:** uncommitted

- **Why the door took ~3 minutes.** The Zero cold-boots on every insertion. Before answering PING, its signer imported `eth_account` (pydantic, plus `py_ecc` building BLS pairing tables at import time). That's 0.25 s warm and 2.5 s cold on the Mac, and a single-core ARMv6 is roughly 50× slower. On top of that, cloud-init ran its four Python stages every boot, and the apt, man-db and e2scrub timers fired at every boot (no real clock) on the same core.
- `zero-tx-signer.py`: the door path (PING/ADDR/DOOR) now needs only pycryptodome's keccak and an in-file secp256k1 signer (the same Jacobian math and deterministic nonce as eth_keys' native backend). It imports in 16 ms on the Mac. `eth_account` loads lazily, for SIGN or once to derive the key from the mnemonic, and that key is cached at `/var/lib/zero-signer/derived-key` (0600, tagged with a sha256 of the mnemonic). PONG now carries `up=` / `ready=` uptime.
- `zero-speedup.sh` (runs once on the Zero via cloud-init) + `zero-update-card.sh` (Mac, edits the boot partition): installs the signer only after checking it derives the address in `zero-address.txt`, masks network/Bluetooth/console/ssh units and the overdue timers, starts the signer with `DefaultDependencies=no` + `Nice=-10`, and adds `cloud-init=disabled` to `cmdline.txt`. `zero-trim.sh` removed: it needed SSH to an offline Zero and appended `udev_settle` to `cmdline.txt` on a new line, which breaks that one-line file.
- **Fast boot**: `zero-fastinit.sh` runs as PID 1 (`init=` in `cmdline.txt`) with no systemd and no udev, and the root stays read-only. It mounts `/proc` and `/sys`, sets the `performance` governor, runs `modprobe dwc2 g_serial`, and then the signer. After 3 failures it `exec`s `/sbin/init`. `config.txt` gets `auto_initramfs=0`, `disable_splash=1`, `boot_delay=0` and camera/display auto-detect off. `zero-speedup.sh` applies both. `zero-update-card.sh` backs up `config.txt` too, and strips the `init=` so cloud-init can run again. The `cmdline.txt` edits were tested with GNU sed in a Debian Trixie container. That test caught a first pattern that also matched inside `cloud-init=disabled`.
- `pi4-door.py`: status posts go through one ordered background thread, so the latch never waits on the network. PING wait 120 s → 300 s: before, a Zero slower than 120 s failed until you replugged it. It logs `key awake after Ns (up=…)`, and any key error posts `denied` with the reason.
- **Door status never worked live**: `door_status` had `PRIMARY KEY (residency)` but the upsert used `ON CONFLICT (residency, status, message)`, which Postgres rejects. The table was also never migrated on the droplet, and `DOOR_API_KEY` isn't set there or in `door.env`. Fixed the upsert and added `started_at`, which is kept while the status repeats. The route now uses a constant-time key check, checked before the DB lookup. GET returns `elapsedS`/`ageS`, computed on the server clock.
- Board (`/r/[address]/board`): the small dot is replaced by a full-screen banner. Amber with a spinner and a running timer while checking, green "Welcome, door open", red with the reason when denied. "In the house" refetches every 1 s while the door is open.
- Verified: 1,500 random keys give an address and signature byte-identical to `eth_account`. Mnemonic cache: created 0600, reused, and rejected once the mnemonic changes. `tsc --noEmit` clean, and eslint finds nothing new in the changed files. Production build of the working tree on :3101: status API 403 without the key, 400 on a bad status, elapsed kept and then reset. The real `pi4-door.handle_key()` against the new signer over a bridged pty pair (servo stubbed) opened twice and recorded an in and an out, and the server verified the signatures. 480×320 headless screenshots of the checking, open and locked states. `zero-update-card.sh` was dry-run on a mock boot partition. **Not run on the Zero or the Pi 4 yet** (the Pi 4 wasn't reachable on the LAN), so the new boot time isn't measured.
- Mainnet: no change is needed for the door with `DOOR_RULE=pair`. `staked`/`active` need `RPC_URL` switched to mainnet and a real mainnet residency. The Zero's `ZERO_CHAIN_IDS` is still Sepolia only; left that way on purpose.

## 2026-09-27 — App overview doc + product blog post
**Commit:** `dd864d3`

---

## 2026-09-27 — App overview doc + product blog post
**Commit:** `dd864d3`

- `docs/app-overview.md`: standalone doc describing AI City and its connection to Extropianism, Infomorphism, the Sovereign Individual, and the Network State. Covers what the app does, the two-layer model, and what's live on mainnet today.
- `/blog/ai-city-app` (`web/app/blog/ai-city-app/page.tsx`): blog post — "AI City: A coordination primitive for the network state". Product-focused counterpart to the existing infomorph-extropianism vision post. Covers extropian principles applied, the infomorph stack grouping layer, the sovereign individual thesis, and how pop-up cities compress the network state arc.
- Blog index (`web/app/blog/page.tsx`): added the new post as the first listing.
- DEVLOG.md: updated current state table (blog count, cleaned up stale items).
- Verified: `tsc --noEmit` clean. Commit pushed to `origin/city-layer` (`dd864d3`). **Not deployed to the droplet** — Konrad's deploy credentials are needed.

---

## 2026-09-27 — Board shows who's in the house, from signed check-ins at the door
**Commit:** `6ccec1c` (web, deployed to https://aicity.cyou); `web/hardware/pi4/pi4-door.py` changes uncommitted with the rest of the door

- `door_checkins` table (`web/db/schema.sql`): one row per key insertion that opened the door, `direction` alternating in/out per wallet, `challenge` UNIQUE so each is single-use.
- `web/lib/server/door.ts`: `issueChallenge()` makes a 32-byte challenge (8-byte issue time, 8 random bytes, 16-byte HMAC keyed from `SESSION_SECRET`), so there's no table of open challenges; valid 5 minutes. `recordCheckin()` checks the HMAC and age, recovers the signer from `doorMessage()` (same text as the Zero and door sign), and inserts the toggled direction. `getPresence()` returns who's inside plus the last 8 events. It shows a name only for a listed profile, and a seat as `Host` or the bed from an approved application.
- Routes: `GET /api/residencies/[address]/door/challenge`, `GET` / `POST /api/residencies/[address]/door/checkins`. README tables updated.
- Board (`/r/[address]/board`): an "In the house" row (name, short wallet, seat), polled every 5 s, and the latest door events at the front of the activity strip.
- `pi4-door.py`: gets the challenge from the app (origin from `board-url.txt`, or `APP_URL`), opens the latch, then posts the signature while it's open. If the app is unreachable it falls back to a local challenge and still opens, unrecorded. `APP_URL` added to `door.env.example`.
- Verified: `tsc --noEmit` clean; `pnpm lint` is 37 problems before and after (none in the changed files). Against the local dev server, the API test covered in, out and in again, a replayed challenge (409) and a forged one (400). The first run found challenges issued in the same second were identical, so the random bytes were added. The real `zero-tx-signer.py` and `pi4-door.handle_key()` were run over a pty pair against localhost (servo stubbed) and recorded an out and an in. A 480×320 headless Chrome screenshot of the board showed the row fitting. Live: the challenge route answers, `/door/checkins` returns empty, the board is 200, and the Pi's kiosk was restarted onto the new build.
- **Known gaps:** the new `pi4-door.py` is staged at `~/pi4-door.py` on the Pi 4; installing it into `/opt/aicity-door` needs sudo with Konrad's password. The Zero wallet `0x2C0a…f798` has no profile, so the board shows its address, not a name. Presence is public, like the board: anyone with the URL can see who's in the house. Consider a board token before a real house uses it. A guest holding their own key could sign a challenge away from the door; binding check-ins to the door (a door API key) would close that.
- Demo data: live profile `KonradGnat` (listed) added by hand for the Zero wallet `0x2c0a…f798`, since the Zero can't sign in. Remove after the demo. The Zero card now carries the faster-boot `zero-tx-signer.py` (pure-Python secp256k1 for the door path; 300 random keys gave byte-identical signatures and addresses to `eth_account`, and the mnemonic path plus `derived-key` cache gave the same address). Its `instance-id` was bumped to `aicity-zero-2026-09-27-signer2` so `setup.sh` reinstalls on the next boot with the same key.

## 2026-09-27 — Mainnet: factory deployed, live site switched to chain 1
**Commit:** uncommitted

- `script/Deploy.s.sol` broadcast to Ethereum mainnet with the `ai-city-sepolia` foundry keystore (`0xff7b…7E64`, funded 0.002 ETH). `ResidencyFactory` `0x0Abd146EB01d8b923C2162489E006b7b01C77A57`, tx `0x79d155d4db8c377ef03e6cad3a17cdedc8695f78f19b2281705dd2100a325313`, block 26064603, cost 0.000097 ETH. `usdc()` reads back real USDC. Contract code unchanged from the Sepolia build.
- Droplet: `.env.local` backed up (`.env.local.sepolia-bak-*`), DB dumped (`backups/ai_city-20260926-222758-pre-mainnet.sql`, server UTC). Set `NEXT_PUBLIC_CHAIN_ID=1`, mainnet publicnode RPC for browser and server, the new factory, deploy block and USDC. Redeployed with `deploy-droplet.sh`; health 200, `/`, `/cities`, `/cities/zion`, `/docs/contracts`, `/api/cities` all 200, `/docs/contracts` shows the new factory.
- Docs: README deploy section, `master-plan.md` §4, `ethglobal-submission.md` networks.
- Verified before broadcast: `forge test` 30/30, fork test 1/1 against mainnet USDC, dry-run simulation.
- **Gaps:** not source-verified (no `ETHERSCAN_API_KEY`; `forge verify-contract --verifier sourcify` errored). World ID on the droplet is still staging/unconfigured, so real users can't pass the human gate. The Zion and Singapore cities in the live DB point at Sepolia residencies, which don't exist on mainnet. No 1 USDC smoke test yet.

## 2026-09-27 — Pi Zero signer card built fully offline; first door open on hardware
**Commit:** uncommitted

- Plain Pi Zero (no Wi-Fi). Its old card is Raspbian Jessie (Python 3.4), too old for `eth-account`, so it was kept untouched as a backup and a spare 16 GB card was flashed with Raspberry Pi OS Lite armhf (Trixie 2026-09-15, Python 3.13).
- The Zero never touches a network, including during install. On the Mac, `pip download --platform linux_armv6l --python-version 3.13 --only-binary=:all:` from piwheels + PyPI fetched all 25 wheels (armv6 builds of `pydantic-core`, `ckzg`, `bitarray`, `cytoolz`, `regex`, `pycryptodome`), 11 MB. They go on the boot partition with the signer, and cloud-init `runcmd` runs `web/hardware/pi-zero/zero-offline-setup.sh`: `venv --without-pip`, pip run from its own wheel with `--no-index`, the service installed, `g_serial` via `/etc/modules-load.d`, and the key created offline. Only the address is written back to `/boot/firmware/zero-address.txt`. `config.txt` gets `dtoverlay=dwc2,dr_mode=peripheral`, and `cmdline.txt` gets `ds=nocloud;i=…`.
- Verified: the setup script was run in a `linux/arm/v7` Debian Trixie container (wheel tags relabelled for the test), then for real on the Zero. `zero-setup.log` shows all packages installed with no errors. Zero address `0x2C0a1124c177f6c7E2084b5e8B7b47d98c44f798`. Plugged into the Pi 4, it enumerated as `Gadget_Serial` → `/dev/ttyACM0`, and `aicity-door` logged `OPEN 0x2C0a…f798: enrolled as this door's key`, then `locked` 9 s later.
- **Gotchas:** macOS blocks `dd` to `/dev/rdiskN` from this agent's process even as root (TCC), so the flash ran from Terminal.app (`~/Downloads/pi-zero/flash.sh`). The first micro-USB cable was power-only: the Zero booted and finished setup but never enumerated. The Pi 4 reported `throttled=0x50000` (under-voltage has occurred since boot) on the power bank.
- Follow-ups: fold the no-Wi-Fi offline path into `docs/pi-zero-offline-signer-setup.md`; fund the Zero address on Sepolia; a real Sepolia residency for the `staked`/`active` door rules.

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

## 2026-09-27 — Zion and Singapore D/ACC Hardware City copied to the live instance
**Commit:** none (data only)

- Copied two cities from the local DB to production (https://aicity.cyou), leaving out the local `*-e2e*` test cities and their 15 API keys: `zion` (residency `0x7fb7…4588`, "Zion Hardware Buliders") and `singapore-d-acc-hardware-city` (residency `0x2488…0100`, "D/ACC Hardware Hacker House"). Both residencies are real Sepolia deployments (blocks 11787326 / 11787439), so their onchain state reads live.
- Rows: 2 users + profiles (founders; no nullifier), 2 cities, 2 core-team founders, 2 series, 2 proposals (`deployed`), 2 residencies, 2 pending applications. Inserted in one transaction with fresh ids; foreign keys were remapped by slug (prod city ids are now 2 and 3, proposal ids 4 and 5). Each residency's pinned metadata still says `proposalId` 1/2 (the local ids). It is only read at deploy time, and the hash is onchain, so it stays.
- Backup before the import: `/root/ai-city/backups/ai_city-20260926-215137-pre-zion-singapore.sql` on the droplet (server time is UTC).
- Verified: `/cities/zion`, `/cities/singapore-d-acc-hardware-city`, both `/r/…` and `/r/…/board` return 200, and `/api/cities` lists all three cities.

## 2026-09-27 — Status board fits the Pi's 3.5" screen; QR to the city; sample city calendar
**Commit:** `73db1ed`, `517d255`

- `/r/[address]/board` no longer shows the site header or footer: `components/not-on-board.tsx` wraps them in `app/layout.tsx` and hides them on board routes, and the board container is `z-50`.
- `board-client.tsx` was re-laid out for 480×320 (the Pi's `piscreen` at scale 1): smaller type and padding, deadline and dates share a row, the USDC tiles shrink, and activity moves into a one-line strip at the bottom. It still scales up with `md:` sizes on bigger screens.
- The board shows a QR code (`qrcode.react`, rendered locally as SVG) and the spelled-out link to the city home page (`<origin>/cities/<slug>`, or the residency page when there's no city).
- City calendar, **dummy data only**: `lib/city-calendar.ts` builds a sample week relative to today (there's no events table). `components/city-calendar.tsx` provides `CityCalendar` (on `/cities/[slug]`, grouped by day, marked "Sample events") and `BoardCalendar` (the next 3 events on the board).
- Verified: `tsc --noEmit` clean; eslint clean on the changed files (`pnpm lint` still fails on 25 errors elsewhere, e.g. `knowledge-manager.tsx`). Headless Chrome screenshots: the board in an exact 480×320 frame shows everything with nothing cut off, and the city page renders the calendar. Deployed to https://aicity.cyou (`517d255`). On the real Pi the first deploy was clipped ~20 px on the right: Chromium won't make a window narrower than ~500 px, so the viewport was wider than the 480 px panel. `517d255` caps the board at `screen.width`×`screen.height`. A `grim` screenshot of the Pi after restarting the kiosk shows it fitting.
- Follow-ups: a real `city_events` table + founder editing to replace the sample data.

## 2026-09-27 — Pi 4 seat-key door: Zero challenge signing, GPIO servo, keyboard-free SD card
**Commit:** uncommitted

- `web/hardware/pi4/pi4-door.py` + `aicity-door.service` + `door.env.example`: waits for the Pi Zero's USB gadget port (`/dev/serial/by-id/*Gadget*`, falling back to `/dev/ttyACM*`), sends a random 32-byte challenge, recovers the signer with `eth_account`, and opens the SG90 on GPIO 12 for `DOOR_OPEN_SECONDS`. It opens once per insertion. `DOOR_RULE` is `pair` (the first key enrolls, stored in `/var/lib/aicity-door/paired-address`), `staked` (`getMember().staked`) or `active` (plus `status()` Active and inside `startTime`/`endTime`). Chain reads are plain JSON-RPC `eth_call`, so the Pi doesn't need Foundry. The servo runs on hardware PWM0 through sysfs (`dtoverlay=pwm,pin=12,func=4`), not gpiozero's software PWM.
- `zero-tx-signer.py`: new `DOOR:<residency>:<challenge>` → `DOOR_SIG:<sig>` command. It signs a fixed EIP-191 message (`door_message()`, the same format as in `pi4-door.py`) after a strict regex check. The wallet that stakes through `cold-sign.py` is the same key that opens the door, and one daemon serves both.
- The Pi 4 SD card (boot partition) is set up for no keyboard. cloud-init `user-data` installs `/opt/aicity-door` (a venv with `--system-site-packages`, `eth-account`) and enables the service. `door.env` and `board-url.txt` are edited from the Mac. `instance-id` was bumped to `aicity-board-2026-09-27-door` so cloud-init runs again. The screen stays `piscreen,drm,rotate=0` (landscape).
- `docs/pi4-door-kiosk-setup.md`: how it fits together, the door rules, wiring, SSH checks.
- `docs/pi4-door-kiosk-setup.md` Test 6: a servo-only bench test over SSH (PWM overlay check, stop the service, `close`/`open`/`close`, `test` sweep, 10 cycles, undervoltage check, restart), with a fault table. Linked from `docs/test-checklist.md` 11.7. Run on the Pi 4 on 2026-09-27: 6.1–6.6 pass on the software side (PWM pulse 0.5/1.5 ms, 10/10 cycles, `throttled=0x0`); Konrad confirmed at the desk that the horn moved. `secondBrain.local` doesn't resolve from the Mac, so SSH goes by IP (`arp -a`). Sudo needs a password, but the `gpio` group can drive `pwm0` without it.
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
