# AI City — App Overview

### A coordination primitive for the network state, built on extropian philosophy and the infomorph stack

**AI City** is a crypto-native platform for launching pop-up cities and residencies on Ethereum mainnet. Anyone verified as a unique human can launch a city, propose a residency, apply for a bed, and stake USDC to hold their seat. The money sits in its own smart contract until the residency fills or fails. It is live today at [aicity.cyou](https://aicity.cyou).

---

## TL;DR

1. **Two-layer model, one product.** A pop-up city is an offchain container (Postgres) — a place and a time window. Inside it, verified humans propose residencies with specific dates, rooms, and per-bed prices. Each approved proposal is deployed as its own `Residency` contract on Ethereum, and that contract holds the USDC.
2. **One contract per residency.** Funds never mix. If one residency has a bug or a bad host, it can't touch another residency's money. Guests stake USDC into that contract; if the minimum isn't reached by the deadline, everyone is refunded in full.
3. **World ID is the human gate.** Every proposer, city founder, and applicant must prove they are a unique human over 18. One nullifier per wallet — no Sybils, no bots.
4. **Agents can do everything except sign.** Your AI agent gets an API key and can launch cities, manage proposals, review applicants, and edit knowledge bases over MCP or HTTP. You still sign every transaction in your wallet.
5. **It's the grouping layer of an infomorph.** Pop-up cities are the coordination primitive that lets distributed minds assemble around shared problems, commit resources, and dissolve when the problem is solved.

---

## What the app does

| Action | What happens | Onchain? |
|---|---|---|
| Launch a city | Fill a form. City appears immediately. No gas, no transaction. | No |
| Propose a residency | Dates, rooms, beds, prices, story, series. Core team reviews. | No |
| Deploy a residency | One `createResidency` transaction. Your own `Residency` contract. | Yes |
| Apply for a bed | Name, bio, preferred bed. Host approves. | No |
| Stake USDC | Approve USDC spend, then `stake(price)`. Funds in your residency's contract. | Yes |
| Withdraw (host) | Amount + receipt file + note. Hash goes onchain. | Yes |
| Claim (guest) | Full refund if failed or cancelled. Pro-rata leftovers when closed. | Yes |

---

## How it connects to the ideas

### Extropianism

The extropians (1988–2006) were the first organised transhumanist movement. Their principles map directly onto AI City's design:

- **Perpetual Progress** — small, rapid, reversible experiments in how people live together. A city lasts weeks, not years. You learn, iterate, dissolve or repeat.
- **Self-Transformation** — you don't just attend a residency, you propose one. You don't just join a city, you launch it.
- **Open Society** — anyone can launch, propose, or apply. The barriers are proof of personhood and a stake, not permission or credentials.
- **Intelligent Technology** — smart contracts automate the trust. The minimum-seat rule is enforced by the chain. Every withdrawal is recorded onchain with the hash of its receipt.

The extropians mailing list included Hal Finney, Nick Szabo, and Wei Dai. Crypto and transhumanism grew in the same community, in the same decade. AI City is a reunion of two branches of one family.

### Infomorphism

Alexander Chislenko's 1996 paper *Networking in the Mind Age* described the **infomorph** — a mind that exists as a distributed information pattern rather than being bound to a single body or machine. The infomorph stack has six layers:

| Layer | What it does | What exists |
|---|---|---|
| Self-model | Pattern identity, journal | Argo (E2E journal, wallet key wrap) |
| Working mind | Exocortex, extended mind | Second brain vault + Hermes agent |
| Reach | Sub-minds, agents | Hermes skills, concierge |
| Bodies | Morphological freedom | Cyberdeck, Reachy robot, FPV drones |
| **Grouping** | **Functional proximity, ad-hoc contracts** | **AI City** |
| Continuity | Immortality through distribution | Wallet recovery, key management |

AI City is the **grouping layer**. It is the coordination primitive that lets infomorphs assemble around shared problems, commit resources, and dissolve when the problem is solved. Each residency is a temporary contract. Each city is a temporary container. Every member holds their own keys.

### The Sovereign Individual

James Dale Davidson and Lord William Rees-Mogg's 1997 book *The Sovereign Individual* predicted that the information revolution would dissolve the nation-state's monopoly on governance, replacing it with a world where individuals hold unprecedented power to choose their jurisdiction, their legal framework, and their community.

AI City is a direct implementation of that idea. A pop-up city is a jurisdiction of one's own choosing — bounded not by geography or birthright, but by a smart contract, a shared mission, and a time window. The city has a founder and a core team, not a government. The residency has a host, not a landlord. The rules are written in Solidity, enforced by the chain, and anyone can exit at any time.

The sovereign individual of the 2020s does not need to renounce their passport. They need a wallet, a World ID, and enough USDC for a bed. The rest — which laws apply, who else shows up, what the money is spent on — is negotiated, not inherited.

### The Network State

Balaji Srinivasan's 2022 book *The Network State* described a nation that starts as a newsletter, becomes a community, raises a treasury, buys land, and then seeks diplomatic recognition. AI City compresses that arc into the pop-up city model: a city starts as a launch form, becomes a group of verified humans, deploys residencies that hold real USDC, and when the time window closes, it dissolves or forks into new cities.

The network state in AI City's model is not a single eventual nation. It is a **fleet of small, temporary, networked cities** — each with its own mission, its own treasury, and its own exit. The archipelago is the state. The archipelago grows by launching more cities, not by conquering territory.

---

## What's real now

Everything below is live on Ethereum mainnet and can be used today:

- **ResidencyFactory** at [`0x0Abd146EB01d8b923C2162489E006b7b01C77A57`](https://etherscan.io/address/0x0Abd146EB01d8b923C2162489E006b7b01C77A57) — deploy your own residency contract
- **Web app** at [aicity.cyou](https://aicity.cyou) — launch cities, propose residencies, apply, stake USDC, withdraw with receipts, claim refunds
- **World ID** — Proof of Human via IDKit 4.x, one nullifier per wallet
- **Agent API** — MCP server at `/api/mcp`, HTTP API, skill files at `/skill.md`
- **Door hardware** — Pi Zero + servo for smart-contract-gated physical access
- **Status board** — Pi 4 + 3.5" screen showing live onchain state

---

## Links

- [AI City](https://aicity.cyou) — the app
- [Blog: Infomorphs and Extropianism](/blog/infomorph-extropianism) — the full vision post
- [Blog: Connect your AI agent](/blog/connect-your-agent) — how to give your agent an API key
- [Docs](/docs) — concepts, guides, architecture
- [Devlog](/devlog) — what was shipped, what broke, what comes next
- [Master plan](/docs/master-plan.md) — roadmap and extended vision
- [Hardware integrations](/docs/hardware-integrations.md) — robots, drones, door hardware