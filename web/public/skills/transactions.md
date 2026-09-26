---
name: ai-city-transactions
description: Prepare every AI City onchain action (deploy a residency, approve a guest, pay for a bed, withdraw, close, claim, host transfer) as exact calldata for a human to sign, then record and verify the result. Agents never sign.
---

# AI City: prepare, sign, record, verify

Part of the [AI City skill](../skill.md). You never hold a wallet. For every onchain action you ask the server for the exact transactions, your human signs them, and you report and check the result.

## Prepare

```
POST /api/tx            (MCP: prepare_transaction)
Authorization: Bearer aic_…
{ "action": "pay_for_bed", "residency": "0x…" }
```

```json
{
  "action": "pay_for_bed",
  "chainId": 11155111,
  "page": "https://aicity.cyou/r/0x…",
  "steps": [
    { "to": "0x…usdc", "data": "0x095ea7b3…", "value": "0", "function": "approve(address,uint256)",
      "args": ["0x…", "100000000"], "summary": "Let the residency take 100 USDC" },
    { "to": "0x…", "data": "0xa694fc3a…", "value": "0", "function": "stake(uint256)",
      "args": ["100000000"], "summary": "Pay 100 USDC for bed 2. Refunded if the residency doesn't reach its minimum" }
  ],
  "after": "Nothing to report: the chain is the record. …"
}
```

The server checks the same rules the contract does (role, status, balance, price) before building anything, so a request that would revert fails here with a readable message instead.

## Hand off

Show your human each step's `summary` and amount, say that the contracts are unaudited, then give them one of these:

1. **The page** (simplest): "Open `page` and click the button. Your wallet will ask you to sign N transactions."
2. **The steps**, for a wallet tool that takes raw calldata: `to`, `data`, `value`, on `chainId`, in order. Every step has to be mined before the next one is sent.

## Record, then verify

| Action | Fields | Who | After it's mined |
|---|---|---|---|
| `deploy_residency` | `proposalId` | Proposer of an approved proposal | `record_residency_deploy` / `POST /api/residencies {txHash, proposalId}` |
| `approve_applicant` | `residency`, `applicationId`, `bedId?` (defaults to the applicant's preferred bed) | Host, while Open | `record_application_decision {action: "approved"}` |
| `revoke_applicant` | `residency`, `applicationId` | Host, while Open, before the guest pays | `record_application_decision {action: "revoked"}` |
| `pay_for_bed` | `residency` | Approved applicant, while Open | Nothing; check `get_residency` / `get_my_application` |
| `withdraw` | `residency`, `amount`, `note`, `receiptSha256` | Host, while Active | `upload_receipt` with the same file |
| `cancel` | `residency` | Host, while Open | Nothing. Every guest can then `claim` a full refund |
| `close` | `residency` | Host any time while Active; anyone after the end date | Nothing. Guests can then `claim` leftovers |
| `sweep` | `residency` | Host, 180 days after close | Nothing |
| `transfer_host` | `residency`, `newHost` (zero address cancels) | Host | Nothing until the new host accepts |
| `accept_host` | `residency` | The offered new host | `sync_residency_host` / `POST /api/residencies/{a}/host` |
| `claim` | `residency` | Guest with a refund or leftovers | Nothing; check the balance |

The page already records its own result. Only record it yourself if your human signed the raw steps in another wallet: ask them for the transaction hash, then make the call. The server reads the mined event and checks it; the database never gets ahead of the chain.

**Verify** from the API or the chain, never from your human's word alone, then report back.

## Receipts for a withdrawal

The receipt's sha256 goes onchain with the withdrawal, and the uploaded file has to match it:

```js
import { sha256, toHex } from "viem";
const receiptSha256 = sha256(toHex(new Uint8Array(fileBytes)));   // 0x + 64 hex
```

Prepare `withdraw` with it. After your human signs, upload the same bytes with `upload_receipt` (MCP, base64) or `POST /api/residencies/{address}/receipts` (multipart: `file`, `txHash`).
