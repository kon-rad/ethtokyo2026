---
name: ai-city-auth
description: How an agent acts on AI City without ever holding the wallet. The human signs the sign-in and every transaction, and the agent prepares everything around the signature and checks the result. Required before any write.
---

# AI City: sign in, verification, and who signs

Part of the [AI City skill](../skill.md).

## The rule: your human signs, you don't

**Never ask for, accept, or store a private key or seed phrase.** If your human offers one, refuse and tell them to keep it. Anything that needs the wallet's signature goes to your human:

| What needs a signature | Who signs | What you do |
|---|---|---|
| Signing in (SIWE message) | Human, once every 7 days | Get them signed in, then work with the session |
| Transactions: deploy, approve a guest, pay for a bed, withdraw, close, cancel, claim | Human, in their wallet | Prepare it, send them to the exact page, then check the result |
| Everything else (search, launch a city, propose, apply, review, profile, knowledge) | Nobody | You do it with the session |

AI City has two gates:

1. **Session.** Sign-In with Ethereum. Gives an `aic_session` cookie, valid 7 days.
2. **Verified human.** A World ID proof bound to that wallet, plus an 18+ attestation. Required to launch a city, propose, deploy, apply, or edit a profile.

## Getting a session

### Option A: your human signs in on the site and hands you the session (simplest)

> "Open `<BASE>`, connect your wallet and sign the 'Sign in to AI City' message. Then open DevTools → Application → Cookies, copy the value of `aic_session` and paste it to me. It lets me act for you on AI City for 7 days. It can't move money; every transaction still needs your wallet."

Send `cookie: aic_session=<value>` on every request. Treat it like a password: never log it, write it into a note, or send it anywhere but `<BASE>`.

### Option B: you prepare the sign-in, your human signs the message

For when your human's wallet can sign a plain message outside the site (a CLI wallet, a hardware wallet tool, a wallet's "sign message" feature).

```js
import { createSiweMessage } from "viem/siwe";

const BASE = "https://<site>";
// 1. Nonce. The response sets an `aic_nonce` cookie (10 minutes): keep it.
const { nonce } = await (await fetch(`${BASE}/api/auth/nonce`)).json();

// 2. Build the message for your human's address
const message = createSiweMessage({
  domain: new URL(BASE).host,          // must equal the Host you call
  address: HUMAN_ADDRESS,
  statement: "Sign in to AI City.",
  uri: BASE,
  version: "1",
  chainId,                             // 1 mainnet, 11155111 Sepolia, 31337 local anvil
  nonce,
});
```

3. Show your human the exact message and ask them to sign it with that wallet and paste back the signature (`0x…`).
4. Verify, sending the `aic_nonce` cookie back:

```
POST /api/auth/verify   { "message": "<the exact message>", "signature": "0x…" }
→ 200 { ok: true, me }  and  Set-Cookie: aic_session=…
```

Keep a cookie jar: capture every `Set-Cookie` and send cookies back on the next request. The signature must be over the message byte for byte, so don't reformat it. Smart-contract wallets work too (ERC-1271/6492).

| Error | Cause | Fix |
|---|---|---|
| `401 Sign-in expired, try again` | No `aic_nonce` cookie, or 10 minutes passed | New nonce, new message, ask again |
| `401 Invalid sign-in nonce` | Message nonce ≠ cookie nonce | Use the nonce from the same response |
| `401 Sign-in domain mismatch` | `domain` ≠ the Host you called | Use `new URL(BASE).host` |
| `401 Signature check failed` | Signed by another address, or the message was altered | Check the address; have them sign the exact text |

Sign out: `POST /api/auth/logout`. When a call returns `401 Sign in with your wallet first`, the session has expired: ask for a fresh one.

## Handing off a transaction

Every on-chain action has a page on the site where your human can do it in one click. **That page also reports the result to the API**, so there's nothing for you to submit afterwards. The pattern:

1. **Prepare.** Read the current state, work out the exact action, and write it out plainly: contract, what it does, amount in USDC, and what can't be undone.
2. **Hand off.** "Open `<BASE>/r/0x…` and click *Pay* in the Apply section. Your wallet will ask you to approve 200 USDC, then to stake it." Each skill file lists the page for each action.
3. **Wait** for your human to say it's done, or poll.
4. **Verify** from the API or the chain, never from their word alone, then report back.

If your human would rather sign in their own wallet tool than on the site, give them the call instead (`to`, function, arguments, or `data` from viem's `encodeFunctionData`). Ask them for the transaction hash afterwards, and make the API report yourself as described in the skill file (e.g. `POST /api/residencies` with `{ txHash, proposalId }`).

## Check who you are

```
GET /api/me
→ { "me": { "address": "0x…", "verified": true, "adult": true, "name": "Konrad Gnat" } }
→ { "me": null }   // not signed in
```

- `verified && adult` → you can do everything.
- `name: null` → no directory profile yet. Offer to create one ([directory.md](directory.md)).

## Verification is your human's job too

World ID proves a unique living human holds the wallet. An agent can't produce the proof. If `verified` or `adult` is false and the task needs it:

> "AI City needs you to verify once with World ID. Open `<BASE>/verify` with the same wallet, scan with World App and confirm you're 18+. Tell me when that's done."

Then `GET /api/me` again. A `403 Verify you're a human over 18 first` on any write means the same thing.

For local development only, a server started with `ALLOW_DEV_VERIFY=1` accepts `POST /api/world/dev-verify` (empty body). It returns 404 everywhere else.
