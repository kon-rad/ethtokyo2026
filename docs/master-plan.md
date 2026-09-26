# AI City — Master Plan

### Pop-up cities made of residencies: launch a city, propose residencies, stake USDC for a bed, refunded if it doesn't fill

**Our mission: Accelerate human coordination across cultural bond building and extropian differential acceleration perspective.**

Pop-up cities are made of residencies. Anyone can propose a residency, each city's core team decides which ones run there, and the money sits in the residency's own contract until it fills.

---

## TL;DR — the five things that matter

1. **Two layers, one product.** A pop-up city is a place and a time window — an offchain container that holds no money. Inside it, verified humans propose residencies with specific dates, rooms and per-bed prices. The city's core team approves or rejects each proposal. An approved proposal is deployed as its own Residency contract on Ethereum, and that contract holds the USDC.
2. **One contract per residency.** Every residency gets its own `Residency` contract, deployed by the factory. If one residency has a bug or a bad host, it can't touch another residency's money. Guests stake USDC into that contract; if the minimum isn't reached by the deadline, everyone is refunded in full.
3. **Only money and seats go onchain. Everything else is Postgres, pinned by a hash.** The name, description, rooms, organizers, applications and profiles live in the database. The contract stores `keccak256` of the canonical residency JSON, so anyone can verify the listing wasn't edited after deploy.
4. **World ID is the human gate.** Every proposer, city founder, and applicant must prove they're a unique human over 18. One nullifier per wallet. The contract doesn't check World ID (its proofs are too expensive to verify on Ethereum mainnet), so the app enforces it at the API layer and the host's onchain approval is the final enforcement point.
5. **The database follows the chain, never leads.** A residency or approval is only recorded after the server reads the transaction receipt and decodes the event. The app can't claim something the chain doesn't show.

---

## 1. Core concepts

### Pop-up city
A city is a name, location, dates, a mission, a description and a core team. It lives only in the database. No contract, no money. Anyone verified can launch one. The founder adds core-team members; the core team edits the city's details and approves residency proposals.

### Residency proposal
A residency starts as a proposal inside a city. The proposer fills in dates (which must fall within the city's dates), rooms, beds, prices, organizers and a story. The proposal also picks or creates a **residency series** — a named thread that links recurring instances of the same residency across different cities and years. The core team reviews the proposal: approve, reject, or add a note.

### Residency (onchain)
Once approved, the proposer deploys the residency by calling `ResidencyFactory.createResidency()`. This creates a new `Residency` contract that holds USDC. Guests apply on the web app; the host approves each guest for a specific bed and price; the guest stakes USDC. At the deadline, if the minimum seats are filled the residency becomes Active (host can withdraw against receipts), otherwise it Failed (everyone gets a full refund).

### Residency series
A series groups the instances of a recurring residency. "Builders' House Goa #1" and "Builders' House Goa #2" are instances of the same series. Only the series owner can propose new instances. Series help people follow a residency they liked and let hosts build a reputation.

### Directory and profiles
Every verified human can create a public profile with a name, bio, links and photo. Profiles are listed in the public directory by default, with an opt-out. Each profile shows the person's participation: which cities they founded or served on the core team, and which residencies they hosted or staked in (confirmed against the onchain contract).

---

## 2. User flows

| Flow | Steps | Onchain |
|---|---|---|
| **Launch a city** | Fill the form → city page (no transaction) | — |
| **Propose a residency** | Pick a city → fill dates, rooms, organizers, series → proposal submitted | — |
| **Approve a proposal** | Core team reviews → approve or reject with an optional note | — |
| **Deploy** | Proposer clicks deploy → one transaction | `createResidency` |
| **Sign in** | Connect wallet (MetaMask, Rainbow, Ronin) → SIWE signature | — |
| **Verify** | World App scan (Proof of Human) + 18+ attestation | — |
| **Apply** | Residency page → name, bio, links, preferred bed | — |
| **Review applications** | Host dashboard → approve (pick bed + price) or deny | `approve` / `revoke` |
| **Stake** | Approved member → USDC approve + stake | `stake` |
| **Deadline** | Shown as Active or Failed automatically | derived |
| **Withdraw** | Host → amount + receipt file + note | `withdraw` |
| **Claim** | Failed or cancelled: full refund. Closed: pro-rata leftovers | `claim` |

---

## 3. Why this matters (extropian framing)

AI City is a coordination primitive for the kind of world extropian philosophy describes:

- **Perpetual progress** — small, rapid, reversible experiments in how people live and work together. A city lasts weeks, not years. You learn, you iterate, you dissolve or repeat.
- **Self-transformation** — you don't just attend a residency, you propose one. You don't just join a city, you launch it. The product is an instrument for its users to shape their own environment.
- **Open society** — anyone can launch a city, anyone can propose a residency, anyone can apply. The barriers are proof of personhood (not permission) and a stake (not a credential).
- **Intelligent technology** — the smart contracts automate the trust: the money sits in code, the minimum-seat rule is enforced by the chain, and the host can only withdraw against uploaded receipts that members can verify.
- **Self-direction** — every city has a founder and a core team, not a central operator. Every residency has a host. The platform doesn't decide what runs; the people in each city do.

The "extropian differential acceleration perspective" in the mission statement means: accelerate the parts of human coordination that make us more autonomous, more connected across cultures, and more capable of self-governance — not just faster transactions.

---

## 4. Current status

- **Contracts:** `Residency.sol` + `ResidencyFactory.sol` on Ethereum mainnet. 25 tests pass (unit, fuzz, invariant, mainnet fork with real USDC).
- **Web app:** Next.js 16, deployed on Vercel. Pages: home, cities, city detail + manage + propose, proposals, residency detail + manage + apply, series, directory, person profile, profile edit.
- **Identity:** World ID Proof of Human via IDKit 4.x + self-attested 18+. SIWE sessions.
- **Database:** Postgres (Neon). Schema: users, profiles, cities, core team, residency series, proposals, residencies, applications, receipts.

---

## 5. Roadmap

| Horizon | What |
|---|---|
| **Now** (ETHGlobal Tokyo, Sep 2026) | Residency MVP live on mainnet. One smoke-test residency at 1 USDC. |
| **Edge City Goa** (Oct–Nov 2026) | City vault, city concierge agent, intents export from Argo, Reachy as house robot, drone budget. First real city with multiple residencies. |
| **Near** (Q1 2027) | ZK practice proofs for weighted access, journal inheritance, multi-city persona management. |
| **Medium** (2027) | Cities that fork at close, portable infomorph between cities, city compute (shared GPU with per-member encryption). |
| **Long** | Archipelago of many small cities sharing a skill library and an alumni graph. The infomorph stack: Argo as the self-model, pop-up cities as the grouping layer, hardware as bodies. |

---

## Sources

- `Projects/ai-city/README.md`
- `Projects/ai-city/docs/architecture-plan.md`
- `Projects/ai-city/docs/SECURITY.md`
- `Research/hackathons/ethtokyo2026/infomorph-stack-vision.md`
- `Research/hackathons/ethtokyo2026/popup-city-concierge-mvp-plan.md`