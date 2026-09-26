# ETHGlobal Tokyo 2026 — Submission Answers
### AI City: the Tech Stack page of the project form

**Prepared:** 2026-09-27
**Repo:** https://github.com/kon-rad/ethtokyo2026
**Live (Ethereum mainnet):** https://aicity.cyou

---

## Before you hit submit

1. **Push the repo.** GitHub `main` is still at the first commit (`9d36013`). The 13 commits since then are local only, and about 57 files are uncommitted (agent access, MCP server, Pi 4 door, World ID config). The judges verify from the public repo, so right now they'd see almost none of the work.
2. **Commit the uncommitted work in pieces.** The rules ask for frequent commits, not a few commits carrying large changes. The agent-access work alone is big, so split it (API keys, `/api/tx`, MCP server, skills/docs) instead of making one catch-up commit.
3. **Confirm the AI-tools answer below.** It's drafted from the commit history, which shows Claude Code on 10 of 14 commits. The field's grey example text mentions ChatGPT; that's ETHGlobal's placeholder, not something you said, so it's left out unless you did use ChatGPT.
4. **Design tools: fill in yourself.** Nothing in the repo shows which one you used for the logo or the UI.

---

## Tech Stack

### Are you using any Ethereum developer tools for your project?

| Select | Used for |
|---|---|
| **Foundry** (forge, anvil, cast) | Contracts, 30 tests (unit, fuzz, invariant, mainnet fork), local chain for e2e, deploy scripts, `cast calldata` in the Pi Zero signer flow |
| **OpenZeppelin** | Contract libraries (`lib/openzeppelin-contracts`) |
| **viem** | Chain reads, ABI encoding, calldata for `/api/tx` |
| **wagmi** | React wallet hooks |
| **RainbowKit** | Wallet connect UI |

Also used, if they're in the dropdown: **SIWE** (Sign-In with Ethereum) for sessions, and the Python libraries **eth-account, eth-abi and eth-utils** on the Raspberry Pis. Don't pick Hardhat, ethers or Etherscan: Hardhat and ethers aren't used, and the mainnet factory isn't Etherscan-verified yet.

### Which blockchain networks will your project interact with?

| Select | Status |
|---|---|
| **Ethereum Sepolia** | Test deployment. Factory `0x7A2E3f097Abd3c1a59D5a762f29d1f02E5A63f89`, mock USDC `0x0abd146eb01d8b923c2162489e006b7b01c77a57` |
| **Ethereum Mainnet** | Live since 2026-09-27. Factory `0x0Abd146EB01d8b923C2162489E006b7b01C77A57` (block 26064603), real USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. |

Select mainnet: the factory is deployed there and the live site reads it.

### Which programming languages are you using in your project?

| Select | Where |
|---|---|
| **TypeScript** | Next.js app, API routes, MCP server, scripts |
| **Solidity** | `Residency.sol`, `ResidencyFactory.sol` (0.8.28) |
| **Python** | Pi Zero offline transaction signer, Pi 4 door and status board |
| **SQL** | Postgres schema, full-text search, the knowledge re-chunk trigger |
| **JavaScript** | Node scripts: migrate, seed, e2e, ABI generation |
| **Bash** | Droplet deploy script |
| **C++** | Arduino seat-key controller (`.ino`). Minor; leave it out if you want the list tight. |

### Are you using any web frameworks for your project?

| Select | |
|---|---|
| **Next.js** | v16, App Router, pages and API routes |
| **React** | v19 |
| **Tailwind CSS** | v4, with `@tailwindcss/typography` |

### Are you using any databases for your project?

| Select | |
|---|---|
| **PostgreSQL** | Cities, proposals, residencies, profiles, API keys, knowledge files and chunks (full-text search). Local in dev, on the droplet for the live instance; Neon planned for mainnet. |

### Are you using any design tools for your project?

no

### Any other specific technologies you're making heavy use of?

Type each and hit enter:

- World ID (IDKit v4)
- USDC
- Model Context Protocol (MCP)
- Together AI
- Llama 3.3 70B
- Raspberry Pi
- Raspberry Pi Zero
- Arduino
- TanStack Query
- Zod
- SIWE
- DigitalOcean
- nginx
- PM2
- Let's Encrypt

What each is for, in case a judge asks:

| Tech | Role in AI City |
|---|---|
| World ID | Proof of personhood gates launching cities, proposing and applying |
| USDC | Guests stake USDC into each residency's own contract |
| MCP | `POST /api/mcp`, 40 tools so people's agents can do everything the UI does |
| Together AI (Llama 3.3 70B Instruct Turbo) | The city and residency concierge, answering from each knowledge base |
| Raspberry Pi Zero | Air-gapped transaction signer over USB serial |
| Raspberry Pi 4 | Residency status board and a door that opens for a staked member's seat key |
| Arduino | Earlier seat-key controller prototype |
| unpdf, mammoth | Text extraction from uploaded PDF and DOCX knowledge files |

### Describe how AI tools were used in your project

Draft, ready to paste once you've confirmed it:

> Claude Code (Claude Opus 5.5) was the main coding assistant. It's credited as co-author on 10 of the 14 commits. I set the design and direction, and it wrote a large share of the code with me: the Residency and ResidencyFactory Solidity contracts and their Foundry tests, the Next.js pages and API routes, the Postgres schema, the MCP server and agent API keys, the transaction-preparation endpoint, the Python scripts for the Raspberry Pi signer and door, the deploy script, and the docs. It also ran the end-to-end test scripts against a local anvil chain to verify each feature.
>
> AI is also part of the product. Each city and residency has a concierge that runs on Llama 3.3 70B through Together AI and answers from that city's knowledge base. People's own AI agents can use AI City through the MCP server and the skill files at /skill.md; the agent prepares each transaction and the human signs it.

Edit the first sentence if other tools were involved (Hermes, ChatGPT, image generation for the logo).

---

## Project rules check

| Rule | Status |
|---|---|
| Start from scratch | First commit `9d36013` on 2026-09-26. OK, assuming no code was carried in from an earlier project. |
| Version control, frequent commits | **At risk.** 14 commits, several large, plus a large uncommitted batch. Commit the pending work in small, feature-sized commits. |
| Open source, public repo | Repo is public (HTTP 200), **but only the first commit is pushed.** Push before submitting. |
| Video ≤ 4 minutes, no speed-up | Not checked; no video in the repo yet. |

---

## Not covered here

The form's other steps (Project details, Images, Select prizes, Video, Future, Final) weren't in the pasted page. `README.md` has most of the Project details material, and `screenshots/` has the images (homepage, city page, Goa city, profile, logo).
