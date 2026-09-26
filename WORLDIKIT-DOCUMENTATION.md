# World IDKit Integration — AI City

### How IDKit proves each residency applicant is one unique human, without revealing who they are

**Project:** AI City — a pop-up city launcher on Ethereum mainnet
**Repo root:** `Projects/ai-city/`
**Prize tracks:** Best Use of IDKit ($5,000), [Cont] Best IDKit Use Case ($2,500)

---

## Trust moment

Before someone can launch a city or apply for a seat in a residency, we need to know they are one unique human. A seat is a scarce, real-world bed — fake accounts would let one person hold or spam many. The credential must be **minimum sufficient assurance**: proof of uniqueness, nothing more.

| Action | What trust is needed | Why this credential |
|---|---|---|
| Launch a city | One unique human | A city founder holds offchain authority. One person should not launch dozens of empty cities |
| Propose a residency | One unique human | Proposals are reviewed by the core team. One person should not flood a city with proposals |
| Apply to a residency | One unique human | A bed is a scarce real-world resource. One person should not occupy multiple beds or hold seats they won't fill |
| Host a residency | One unique human | A host manages USDC onchain and approves guests. The host must be a real person |

**Credential chosen: Proof of Human** — uniqueness only. No name, nationality, passport, or document needed. An 18+ self-attestation checkbox complements it until World's Identity Check `minimum_age` leaves preview.

---

## Where IDKit is integrated

### Client-side — `/web/components/verify-panel.tsx`

The `IDKitRequestWidget` from `@worldcoin/idkit` 4.3.0 renders the World App QR/deep-link. The flow:

1. User connects wallet via RainbowKit, signs SIWE message, gets `aic_session` cookie
2. User ticks "I confirm I'm 18 or older"
3. Client calls `POST /api/world/rp-context` — server signs the IDKit request with the RP signing key (never leaves the server)
4. `IDKitRequestWidget` opens with the signed `rp_context`, `app_id`, and `action`
5. User scans with World App, completes Proof of Human
6. On success, client calls `POST /api/world/verify` with the `IDKitResult`
7. Server forwards the proof to `developer.world.org/api/v4/verify/{rp_id}`, stores the nullifier

**Alternative path (dev only):** `POST /api/world/dev-verify` marks the wallet as verified without World ID, for local anvil development. Returns 404 in production.

### Server-side — `/web/app/api/world/rp-context/route.ts`

```typescript
import { signRequest } from "@worldcoin/idkit-core/signing";
// ...
const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action: config.worldAction });
return Response.json({
  rp_context: { rp_id: rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig },
});
```

The RP signing key is a server env var (`WORLD_RP_SIGNING_KEY`). It is never sent to the client.

### Server-side — `/web/app/api/world/verify/route.ts`

1. Validates the request body with Zod (`adult: true`, `idkitResult` with responses)
2. Forwards the `idkitResult` to `https://developer.world.org/api/v4/verify/{rp_id}`
3. Checks the response environment matches `NEXT_PUBLIC_WORLD_ENV`
4. Verifies the `signal_hash` matches `hashSignal(me.address)` — proof was made for this wallet
5. Stores the nullifier with a `UNIQUE` constraint on `users.nullifier` — **one wallet per human**
6. On duplicate nullifier: returns `409 "This World ID is already linked to another wallet"`

### Guard — `/web/lib/server/http.ts`

```typescript
export async function requireVerified(): Promise<Me> {
  const me = await requireSession();
  if (!me.verified || !me.adult) fail(403, "Verify you're a human over 18 first");
  return me;
}
```

This guard protects every write API that needs a verified human:

| Route | Guard | What it protects |
|---|---|---|
| `POST /api/cities` | `requireVerified` | Launching a city |
| `POST /api/cities/[slug]/proposals` | `requireVerified` | Proposing a residency |
| `POST /api/residencies` | `requireVerified` | Recording a deployed residency |
| `POST /api/residencies/[address]/apply` | `requireVerified` | Applying for a bed |
| `PUT /api/profiles/me` | `requireVerified` | Creating a public profile |
| `POST /api/profiles/me/photo` | `requireVerified` | Uploading a profile photo |

### Client-side guard — `/web/components/require-verified.tsx`

The `RequireVerified` component wraps pages that need verification. If the user isn't verified, it renders the `VerifyPanel` inline instead of the protected content:

```tsx
export function RequireVerified({ children, reason }) {
  const { me, signedIn, loading } = useSession();
  if (!signedIn || !me?.verified || !me?.adult)
    return <VerifyPanel />;
  return <>{children}</>;
}
```

Used on: `/r/[address]/apply`, and any page that renders gated content.

### Database — `/web/db/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  address            TEXT PRIMARY KEY,                -- lowercase 0x address
  nullifier          NUMERIC(78, 0) UNIQUE,           -- World ID nullifier: one wallet per human
  verified_at        TIMESTAMPTZ,
  adult_attested_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The `UNIQUE` constraint on `nullifier` enforces **one wallet per human** at the database level — even if the wallet changes, the same nullifier can't be reused.

### Packages — `/web/package.json`

```json
"@worldcoin/idkit": "^4.3.0",
"@worldcoin/idkit-core": "^4.3.0",
```

---

## Configuration

All values in `.env.example`:

| Variable | Purpose | Public/Server |
|---|---|---|
| `NEXT_PUBLIC_WORLD_APP_ID` | World Developer Portal app ID | Public (browser) |
| `NEXT_PUBLIC_WORLD_ACTION` | Action name (e.g. `ai-city-verify-human`) | Public |
| `NEXT_PUBLIC_WORLD_ENV` | `"production"` or `"staging"` | Public |
| `WORLD_RP_ID` | RP ID from Developer Portal | Server only |
| `WORLD_RP_SIGNING_KEY` | Hex signing key for RP context | Server only |
| `ALLOW_DEV_VERIFY` | `=1` enables the dev-skip endpoint | Server only |
| `NEXT_PUBLIC_ALLOW_DEV_VERIFY` | `=1` shows "Dev: skip World ID" button | Public |

---

## Flows demonstrated

### Success path

1. User connects wallet, signs SIWE → session cookie
2. User navigates to `/verify` or a gated page
3. User sees "Verify you're a human" panel, ticks 18+, clicks "Verify with World ID"
4. World App opens, user completes Proof of Human scan
5. Server verifies the proof with World Developer Portal
6. Server stores nullifier, marks `verified_at` and `adult_attested_at`
7. UI shows: "✓ You're verified as a unique human, 18 or older"
8. User can now launch cities, propose residencies, and apply for beds

### Alternative paths

| Scenario | What happens | Response |
|---|---|---|
| **Already verified, different wallet** | Same World ID, second wallet | `409 "This World ID is already linked to another wallet"` |
| **Cancelled in World App** | User closes the scan | `"Verification cancelled in World App."` |
| **Proof rejected by World** | Developer Portal rejects the proof | `"World ID rejected the proof (code)"` |
| **Proof from wrong environment** | Proof is `staging` but app expects `production` | `"Proof is from the staging environment"` |
| **Wrong wallet signal** | Proof was made for address A, wallet B submits it | `"This proof was made for a different wallet"` |
| **Unverified user tries a gated action** | No `verified_at` in database | `403 "Verify you're a human over 18 first"` |
| **World ID not configured on server** | `WORLD_RP_SIGNING_KEY` or `WORLD_RP_ID` missing | `503 "World ID is not configured on this server"` |

---

## How to test

### Local development (anvil + Postgres + `pnpm dev`)

1. **Set up env vars**

```bash
cd Projects/ai-city/web
cp .env.example .env.local
```

Edit `.env.local`:
- `NEXT_PUBLIC_CHAIN_ID=31337`
- `NEXT_PUBLIC_FACTORY_ADDRESS` — from `forge script script/DeployLocal.s.sol`
- `NEXT_PUBLIC_USDC_ADDRESS` — from the same deploy output
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — your Reown project ID
- `NEXT_PUBLIC_WORLD_APP_ID=app_staging_xxx` — use the staging app from the World Developer Portal
- `NEXT_PUBLIC_WORLD_ACTION=ai-city-verify-human`
- `NEXT_PUBLIC_WORLD_ENV=staging`
- `WORLD_RP_ID=rp_staging_xxx`
- `WORLD_RP_SIGNING_KEY=...`
- `SESSION_SECRET=...` — `openssl rand -hex 32`
- `ALLOW_DEV_VERIFY=1`
- `NEXT_PUBLIC_ALLOW_DEV_VERIFY=1`
- `DATABASE_URL=postgres://localhost/ai_city`

2. **Start the stack**

```bash
# Terminal 1 — local chain
anvil

# Terminal 2 — deploy contracts
cd contracts && forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3 — database + dev server
createdb ai_city
cd web && DATABASE_URL=postgres://localhost/ai_city node scripts/migrate.mjs
pnpm dev --port 3100
```

3. **Test the dev-verify path (skips World ID)**

```bash
# Run the seed script — signs in, dev-verifies, launches a city, creates proposals
node scripts/seed-local.mjs

# Run the e2e test — exercises the full lifecycle including verification checks
node scripts/e2e-local.mjs
```

The e2e test specifically checks:
- `unverified status === 403` — unverified wallet can't launch a city
- `dev-verify returns verified && adult` — dev path works
- Each user's `me.verified` and `me.adult` are set correctly

4. **Manual browser test with dev-verify**

Open `http://localhost:3100`. Connect with MetaMask (anvil account #0). Navigate to `/verify`. Tick the 18+ checkbox. Click "Dev: skip World ID". You should see the success notice. Now you can launch cities and apply for residencies.

5. **Manual browser test with real World ID (staging)**

Set `NEXT_PUBLIC_WORLD_ENV=staging` and use the staging World App. Complete the Proof of Human scan through the IDKit widget. The server forwards to `developer.world.org/api/v4/verify/{rp_id}` (staging).

### Sepolia staging (shared droplet)

The Sepolia build deploys to a DigitalOcean droplet. The env uses `NEXT_PUBLIC_WORLD_ENV=production` (World's production API). For testing:

1. Deploy: `AICITY_DEPLOY_SERVER=root@<host> AICITY_DEPLOY_SSH_KEY=~/.ssh/<key> web/scripts/deploy-droplet.sh`
2. Open the droplet's domain in a browser
3. Connect wallet, sign in, navigate to `/verify`
4. Complete Proof of Human through the World App
5. Verify that the nullifier is stored and the user can launch cities

**Important:** The droplet build uses `production` env. `ALLOW_DEV_VERIFY` returns 404 there. Real World ID is required.

### Production (mainnet)

1. World Developer Portal: create production app, note `app_id`, `rp_id`, generate signing key, create action `ai-city-verify-human`
2. Set `NEXT_PUBLIC_WORLD_ENV=production` in Vercel env vars
3. Deploy to Vercel
4. Smoke test with a real World ID

---

## Security model

| Threat | Mitigation |
|---|---|
| RP signing key leaked | Never set `WORLD_RP_SIGNING_KEY` on the client. The key is server-only, used only by `@worldcoin/idkit-core/signing` |
| Stolen session | HTTP-only signed cookie (`jose`), 7-day expiry, scoped to the wallet address |
| Nullifier reused with different wallet | `UNIQUE` constraint on `users.nullifier` — `409` on duplicate |
| Proof submitted for wrong wallet | Server checks `hashSignal(me.address)` matches the proof's `signal_hash` |
| Dev-verify used in production | `POST /api/world/dev-verify` returns 404 when `NODE_ENV=production` or `ALLOW_DEV_VERIFY != 1` |
| Proof from wrong environment | Server checks `verdict.environment` matches `NEXT_PUBLIC_WORLD_ENV` |

---

## Integration debrief

See `docs/WORLD-IDKIT-DEBRIEF.md` for the full debrief required by the prize.

**Summary:**

- **Time to first successful verification:** ~30 minutes (IDKit 4.x has a straightforward client + server flow; `@worldcoin/idkit-core/signing` makes RP signing trivial)
- **Friction:** None major. The IDKit widget is well-documented. The main gotcha was ensuring `NEXT_PUBLIC_WORLD_ENV` matches the proof's environment — the server-side environment check caught staging vs production mismatches
- **Missing capability:** Onchain 4.0 verification isn't available on Ethereum mainnet (World Chain / Arc only). This forced the server-side verification path
- **Most impactful improvement:** A server-side middleware that checks `verified && adult` on every gated API route via a single `requireVerified()` call was the cleanest pattern — one guard, reused everywhere