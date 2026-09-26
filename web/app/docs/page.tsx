import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";
import { addressUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Docs — AI City",
  description: "How AI City works: concepts, guides, architecture, and the extropian vision behind pop-up cities.",
};

const sections = [
  {
    id: "concepts",
    title: "Core concepts",
    items: [
      { id: "city", title: "Pop-up city" },
      { id: "proposal", title: "Residency proposal" },
      { id: "residency", title: "Residency (onchain)" },
      { id: "series", title: "Residency series" },
      { id: "directory", title: "Directory and profiles" },
    ],
  },
  {
    id: "guides",
    title: "How-to guides",
    items: [
      { id: "connect", title: "Connect your wallet and sign in" },
      { id: "verify", title: "Verify you're a human with World ID" },
      { id: "launch-city", title: "Launch a pop-up city" },
      { id: "propose-residency", title: "Propose a residency" },
      { id: "approve-proposal", title: "Approve or reject a proposal (core team)" },
      { id: "deploy-residency", title: "Deploy a residency contract" },
      { id: "apply-bed", title: "Apply for a bed" },
      { id: "stake-usdc", title: "Stake USDC for your seat" },
      { id: "manage-residency", title: "Manage a residency (host)" },
      { id: "withdraw-receipt", title: "Withdraw funds and upload receipts" },
      { id: "claim-refund", title: "Claim a refund" },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    items: [
      { id: "stack", title: "Stack overview" },
      { id: "contracts", title: "Smart contracts" },
      { id: "contracts-reference", title: "Contract reference →", href: "/docs/contracts" },
      { id: "data-model", title: "Data model" },
      { id: "auth-flow", title: "Session and auth flow" },
      { id: "deploy-flow", title: "Residency lifecycle (deploy flow)" },
      { id: "security", title: "Security model" },
    ],
  },
  {
    id: "extropian",
    title: "Extropian vision",
    items: [
      { id: "why-extropian", title: "Why extropian?" },
      { id: "principles", title: "The principles, applied" },
      { id: "infomorph", title: "The infomorph stack" },
    ],
  },
];

function TOC() {
  return (
    <nav className="space-y-6">
      {sections.map((s) => (
        <div key={s.id}>
          <p className="mb-2 text-sm font-semibold text-foreground">{s.title}</p>
          <ul className="space-y-1 border-l border-line pl-3">
            {s.items.map((item) => (
              <li key={item.id}>
                <a href={"href" in item ? item.href : `#${item.id}`} className="text-sm text-muted hover:text-foreground">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 text-muted">
          How AI City works — concepts, guides, architecture, and the vision behind it.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TOC />
          </div>
        </aside>

        <div className="prose prose-sm prose-gray max-w-none space-y-12">
          {/* ==================== Core concepts ==================== */}
          <section id="concepts">
            <h2 className="text-2xl font-semibold tracking-tight">Core concepts</h2>
            <p className="text-muted">
              AI City has a two-layer model: everything that holds money lives onchain, everything
              descriptive lives in Postgres and is pinned by a cryptographic hash. This page explains
              each piece and how they fit together.
            </p>

            <h3 id="city">Pop-up city</h3>
            <p>
              A <strong>pop-up city</strong> is a place and a time window. It has a name, location,
              dates, a mission, a description, and a core team that runs it. A city lives only in the
              database — it holds no money and has no smart contract. Anyone who has verified their
              humanity with World ID can launch one.
            </p>
            <p>
              The founder starts as the only member of the core team and can add others. The core
              team can edit the city&apos;s details and — most importantly — approves or rejects
              residency proposals. Residencies are the onchain part; the city itself is the
              offchain container that makes them discoverable and governable.
            </p>

            <h3 id="proposal">Residency proposal</h3>
            <p>
              A residency starts as a <strong>proposal</strong> inside a city. The proposer fills in:
            </p>
            <ul>
              <li>Dates (must fall within the city&apos;s window, at least 7 days long)</li>
              <li>Rooms and beds with per-bed prices in USDC</li>
              <li>Organizers and a story (mission, description, property URL)</li>
              <li>A residency series (new or existing)</li>
            </ul>
            <p>
              The proposal is stored in the database with a <code>status</code> field that starts at
              <code>proposed</code>. The core team reviews it and can approve, reject, or add a note.
              An approved proposal can then be deployed as an onchain contract by the proposer.
            </p>

            <h3 id="residency">Residency (onchain)</h3>
            <p>
              A <strong>residency</strong> is a Solidity smart contract deployed by the
              <code>ResidencyFactory</code>. Each residency gets its own contract, so funds never
              mix between different stays. Key facts:
            </p>
            <ul>
              <li>
                <strong>Parameters (immutable):</strong> host, USDC token, metadata hash, start and
                end times, deadline, minimum and maximum seats.
              </li>
              <li>
                <strong>Status machine:</strong> Open → deadline passes → Active (enough seats) or
                Failed (not enough). Active → Closed (via close).
              </li>
              <li>
                <strong>Host can:</strong> approve members for beds, revoke unstaked approvals,
                cancel before the deadline, withdraw against receipts once Active, close anytime.
              </li>
              <li>
                <strong>Members can:</strong> stake USDC for an approved bed, claim a refund if the
                residency fails or is cancelled, claim pro-rata leftovers when it closes.
              </li>
            </ul>
            <p>
              The metadata (name, rooms, prices) is hashed into the contract as a single
              <code>bytes32</code>, so anyone can verify the listing wasn&apos;t edited after
              deploy.
            </p>

            <h3 id="series">Residency series</h3>
            <p>
              A <strong>residency series</strong> links recurring instances of the same stay across
              different cities and years. &quot;Builders&apos; House Goa #1&quot; and &quot;Builders&apos;
              House Goa #2&quot; are instances of the same series. Only the series owner can propose
              new instances. Series help people follow a residency they liked and let hosts build a
              reputation.
            </p>

            <h3 id="directory">Directory and profiles</h3>
            <p>
              Every verified human can create a public profile with a name, bio, links and photo.
              Profiles are listed in the public directory by default (with an opt-out). Each profile
              shows the person&apos;s participation: which cities they founded or served on the core
              team, and which residencies they hosted or staked in — confirmed against the onchain
              contract.
            </p>
          </section>

          {/* ==================== How-to guides ==================== */}
          <section id="guides">
            <h2 className="text-2xl font-semibold tracking-tight">How-to guides</h2>

            <h3 id="connect">Connect your wallet and sign in</h3>
            <ol>
              <li>Click &quot;Connect Wallet&quot; in the top-right corner.</li>
              <li>Choose MetaMask, Rainbow, Ronin Wallet, or WalletConnect.</li>
              <li>
                Your wallet prompts you to sign a message. This is <strong>Sign-In with
                Ethereum</strong> (SIWE) — no gas, no transaction, just proving you control the
                wallet.
              </li>
              <li>Once signed, the header shows your wallet address and a &quot;Verify you&apos;re human&quot; link.</li>
            </ol>

            <h3 id="verify">Verify you&apos;re a human with World ID</h3>
            <ol>
              <li>After signing in, go to <Link href="/verify" className="underline">/verify</Link> or click the &quot;Verify you&apos;re human&quot; link in the header.</li>
              <li>Check the &quot;I confirm I&apos;m 18 or older&quot; box (self-attested — World&apos;s
              <code>minimum_age</code> Identity Check is in preview).</li>
              <li>Click &quot;Verify with World ID.&quot; The World App opens on your phone.</li>
              <li>Scan the QR code with the World App to generate a Proof of Human.</li>
              <li>
                The server verifies the proof against World&apos;s developer API. If valid, your
                wallet is bound to the World ID nullifier. One nullifier per wallet — trying to
                use the same World ID with another wallet returns a 409 error.
              </li>
              <li>
                For local development, set <code>NEXT_PUBLIC_ALLOW_DEV_VERIFY=1</code> to get a
                &quot;Dev: skip World ID&quot; button.
              </li>
            </ol>
            <p>
              <strong>No Orb verification is required.</strong> World ID Proof of Human uses the
              World App&apos;s built-in uniqueness check. You do not need to visit an Orb.
            </p>

            <h3 id="launch-city">Launch a pop-up city</h3>
            <ol>
              <li>Make sure you&apos;re signed in and verified.</li>
              <li>Go to <Link href="/launch" className="underline">/launch</Link>.</li>
              <li>Fill in the name, location, dates, mission and description.</li>
              <li>Submit. The city appears in the listing immediately — no transaction, no gas.</li>
              <li>You become the founder (and the only core team member).</li>
            </ol>

            <h3 id="propose-residency">Propose a residency</h3>
            <ol>
              <li>Go to a city page and click &quot;Propose a residency.&quot;</li>
              <li>Pick an existing series (one you own) or create a new one.</li>
              <li>Fill in the name, location, dates, rooms with per-bed prices, organizers and story.</li>
              <li>Submit. The core team will review your proposal.</li>
            </ol>

            <h3 id="approve-proposal">Approve or reject a proposal (core team)</h3>
            <ol>
              <li>Go to the proposal page (linked from the city page).</li>
              <li>Review the dates, rooms, prices and organizers.</li>
              <li>Click &quot;Approve&quot; or &quot;Reject,&quot; optionally adding a note.</li>
              <li>An approved proposal shows a &quot;Deploy&quot; button for the proposer.</li>
            </ol>

            <h3 id="deploy-residency">Deploy a residency contract</h3>
            <ol>
              <li>Only the proposer of an approved proposal can deploy.</li>
              <li>Go to the proposal page and click &quot;Deploy.&quot;</li>
              <li>Your wallet prompts you to send a transaction to <code>ResidencyFactory.createResidency()</code>.</li>
              <li>After the transaction is mined, the server reads the receipt, decodes the
              <code>ResidencyCreated</code> event, and records the residency in the database.</li>
              <li>The residency page appears at <code>/r/[contract-address]</code>.</li>
            </ol>

            <h3 id="apply-bed">Apply for a bed</h3>
            <ol>
              <li>Browse the residency you&apos;re interested in and click &quot;Apply.&quot;</li>
              <li>Fill in your name, bio, links and preferred bed.</li>
              <li>Submit. The host reviews your application.</li>
              <li>If approved, you&apos;ll see the bed assignment and price on the residency page.</li>
            </ol>

            <h3 id="stake-usdc">Stake USDC for your seat</h3>
            <ol>
              <li>After the host approves your application, go to the residency page.</li>
              <li>Click &quot;Pay [price] USDC to hold your bed.&quot;</li>
              <li>Your wallet prompts you to approve the USDC spend, then call <code>stake(price)</code>. If the host changed your price in the meantime, the payment fails instead of charging the new amount.</li>
              <li>The funds sit in the residency&apos;s own contract until the deadline.</li>
            </ol>

            <h3 id="manage-residency">Manage a residency (host)</h3>
            <ol>
              <li>Go to <code>/r/[address]/manage</code>.</li>
              <li>Review applications: approve each applicant for a specific bed and price, or deny.</li>
              <li>Monitor the seat count, deadline countdown and treasury balance.</li>
              <li>Cancel the residency before the deadline if needed (everyone gets a full refund).</li>
              <li>Close the residency once spending is done (anyone can close it after the end date) to return leftover funds pro-rata.</li>
              <li>Hand the residency to another wallet with &quot;Hand over hosting&quot;; the new wallet accepts on the residency page.</li>
              <li>180 days after closing, sweep whatever guests didn&apos;t claim.</li>
            </ol>

            <h3 id="withdraw-receipt">Withdraw funds and upload receipts</h3>
            <ol>
              <li>Once the residency is Active (deadline passed with enough seats), the host can withdraw.</li>
              <li>Go to <code>/r/[address]/manage</code> and click &quot;Withdraw.&quot;</li>
              <li>Enter the amount, upload a receipt file (PDF, PNG, JPEG or WebP, max 4 MB), and add a note.</li>
              <li>The server hashes the file and submits <code>withdraw(amount, receiptHash, note)</code> to the contract.</li>
              <li>Staked members can view and download all receipts from the residency page.</li>
            </ol>

            <h3 id="claim-refund">Claim a refund</h3>
            <ul>
              <li><strong>Failed or cancelled:</strong> call <code>claim()</code> to get your full stake back.</li>
              <li><strong>Closed:</strong> call <code>claim()</code> to get your pro-rata share of unspent funds. Claim within 180 days: after that the host can sweep what&apos;s unclaimed.</li>
              <li>Each address can claim once. The residency page shows your claimable amount.</li>
            </ul>
          </section>

          {/* ==================== Architecture ==================== */}
          <section id="architecture">
            <h2 className="text-2xl font-semibold tracking-tight">Architecture</h2>

            <h3 id="stack">Stack overview</h3>
            <pre className="overflow-x-auto rounded-xl border border-line bg-gray-50 p-4 text-xs">
{`Browser (client)
  RainbowKit + wagmi + viem | React Query | Next.js App Router
  SIWE session cookie | World IDKit widget | Tailwind CSS
       │                               │
       │ HTTP + JSON API               │ RPC (read)
       ▼                               ▼
Next.js server
  API routes | Server-only lib | postgres driver | jose (JWT)
  @worldcoin/idkit-core/signing | viem public client
       │                               │
       │ SQL                           │ eth_call
       ▼                               ▼
Postgres (Neon)                Ethereum mainnet / anvil
  users | profiles |             ResidencyFactory
  cities | core_team |           Residency (one per stay)
  series | proposals |           USDC (real or mock)
  residencies | apps |
  receipts`}
            </pre>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Layer</th>
                  <th className="py-2 text-left font-medium">Technology</th>
                  <th className="py-2 text-left font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2">Framework</td>
                  <td className="py-2">Next.js 16 + TypeScript + Tailwind</td>
                  <td className="py-2">One deployable on Vercel; API routes are the backend</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Wallets</td>
                  <td className="py-2">RainbowKit + wagmi v2 + viem</td>
                  <td className="py-2">MetaMask, Rainbow, Ronin Wallet and WalletConnect out of the box</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Sign-in</td>
                  <td className="py-2">SIWE + HTTP-only signed cookie (jose)</td>
                  <td className="py-2">Every write API knows which wallet is calling</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Humanity</td>
                  <td className="py-2">@worldcoin/idkit 4.x + server-side RP verification</td>
                  <td className="py-2">Current World SDK; one nullifier per human</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Database</td>
                  <td className="py-2">Postgres (postgres driver, plain SQL)</td>
                  <td className="py-2">Neon in production, local Postgres in dev</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Contracts</td>
                  <td className="py-2">Solidity 0.8.28, Foundry, OpenZeppelin</td>
                  <td className="py-2">One factory + one contract per residency</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2">Chain reads</td>
                  <td className="py-2">viem public client; multicall</td>
                  <td className="py-2">No indexer needed at this scale</td>
                </tr>
              </tbody>
            </table>

            <h3 id="contracts">Smart contracts</h3>
            <p>
              Two contracts, deployed on Ethereum mainnet:
            </p>
            <ul>
              <li>
                <strong>ResidencyFactory</strong> — the singleton factory. Deployed once per chain.
                <code>createResidency(ResidencyParams)</code> deploys a new <code>Residency</code>
                contract. Emits <code>ResidencyCreated</code> with the metadata hash, dates and
                seats as event fields.
              </li>
              <li>
                <strong>Residency</strong> — one contract per residency. Holds USDC. Immutable
                parameters set at construction. Functions: <code>approve</code>, <code>revoke</code>,
                <code>stake</code>, <code>cancel</code>, <code>withdraw</code>, <code>close</code>, <code>sweep</code>,
                <code>transferHost</code>, <code>acceptHost</code>,
                <code>claim</code>. Uses OpenZeppelin&apos;s <code>SafeERC20</code> and
                <code>ReentrancyGuard</code>.
              </li>
            </ul>
            <p>
              Constructor checks: duration ≥ 7 days, deadline ≤ start time, deadline in the future,
              1 ≤ minSeats ≤ maxSeats ≤ 500.
            </p>
            <p>
              <Link href="/docs/contracts" className="underline">
                Read the full contract reference →
              </Link>{" "}
              Every function, who can call it, when, and what it does with your USDC.
            </p>

            <h3 id="data-model">Data model</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Table</th>
                  <th className="py-2 text-left font-medium">Purpose</th>
                  <th className="py-2 text-left font-medium">Key columns</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2"><code>users</code></td>
                  <td className="py-2">Wallet + verification status</td>
                  <td className="py-2"><code>address</code> PK, <code>nullifier</code> UNIQUE, <code>verified_at</code>, <code>adult_attested_at</code></td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>profiles</code></td>
                  <td className="py-2">Public directory entry</td>
                  <td className="py-2"><code>address</code> PK FK, <code>name</code>, <code>bio</code>, <code>links</code> JSONB, <code>photo</code> BYTEA</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>cities</code></td>
                  <td className="py-2">Pop-up city (offchain)</td>
                  <td className="py-2"><code>id</code> PK, <code>slug</code> UNIQUE, <code>name</code>, <code>location</code>, <code>start_time</code>, <code>end_time</code>, <code>founder</code></td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>city_core_team</code></td>
                  <td className="py-2">Who runs a city</td>
                  <td className="py-2"><code>(city_id, address)</code> PK, <code>role</code> (founder/core)</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>residency_series</code></td>
                  <td className="py-2">Recurring residency thread</td>
                  <td className="py-2"><code>id</code> PK, <code>slug</code> UNIQUE, <code>name</code>, <code>description</code>, <code>owner</code></td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>residency_proposals</code></td>
                  <td className="py-2">Proposal before deploy</td>
                  <td className="py-2"><code>id</code> PK, <code>city_id</code>, <code>status</code> (proposed/approved/rejected/deployed)</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>residencies</code></td>
                  <td className="py-2">Deployed onchain contract</td>
                  <td className="py-2"><code>address</code> PK, <code>host</code>, <code>metadata_hash</code>, dates, seats, <code>city_id</code>, <code>proposal_id</code></td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>applications</code></td>
                  <td className="py-2">Guest applications</td>
                  <td className="py-2"><code>id</code> PK, <code>residency</code> FK, <code>applicant</code>, <code>status</code>, <code>bed_id</code>, <code>price_units</code></td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2"><code>receipts</code></td>
                  <td className="py-2">Withdrawal proof files</td>
                  <td className="py-2"><code>id</code> PK, <code>residency</code> FK, <code>tx_hash</code>, <code>receipt_hash</code>, <code>data</code> BYTEA</td>
                </tr>
              </tbody>
            </table>

            <h3 id="auth-flow">Session and auth flow</h3>
            <ol>
              <li>Browser connects wallet via RainbowKit.</li>
              <li><code>GET /api/auth/nonce</code> returns a nonce JWT (10 min expiry) in an HTTP-only cookie.</li>
              <li>Browser signs the SIWE message with the wallet.</li>
              <li><code>POST /api/auth/verify</code> validates the signature, issues a session JWT (7 day expiry) in an HTTP-only cookie.</li>
              <li>Every subsequent API call carries the session cookie. The server reads the wallet address from the JWT and looks up verification status from the database.</li>
            </ol>

            <h3 id="deploy-flow">Residency lifecycle (deploy flow)</h3>
            <ol>
              <li>Proposer submits form → <code>POST /api/cities/[slug]/proposals</code> → server validates, builds canonical JSON, inserts proposal.</li>
              <li>Core team reviews → <code>POST /api/proposals/[id]</code> with <code>&#123;decision: &quot;approve&quot;&#125;</code> → status becomes <code>approved</code>.</li>
              <li>Proposer calls <code>ResidencyFactory.createResidency(params)</code> via wallet → transaction mined → <code>ResidencyCreated</code> event emitted.</li>
              <li>Proposer calls <code>POST /api/residencies</code> with the tx hash → server reads receipt, decodes event, verifies metadata hash/dates/seats match the approved proposal, inserts residency row, updates proposal status to <code>deployed</code>.</li>
            </ol>

            <h3 id="security">Security model</h3>
            <ul>
              <li><strong>Private keys never touch the server.</strong> SIWE proofs are verified; the server only stores a session cookie.</li>
              <li><strong>Receipt files are sha256&apos;d onchain.</strong> The server rejects uploads whose hash doesn&apos;t match the <code>Withdrawn</code> event.</li>
              <li><strong>Receipts are served only to the host and staked members.</strong> The API checks <code>getMember(addr).staked</code> before serving.</li>
              <li><strong>Nullifier uniqueness.</strong> The <code>UNIQUE</code> constraint on <code>users.nullifier</code> enforces one wallet per human.</li>
              <li><strong>Cross-residency isolation.</strong> Each <code>Residency</code> contract holds its own USDC.</li>
              <li><strong>Unaudited.</strong> Only deposit what you can afford to lose.</li>
            </ul>
          </section>

          {/* ==================== Extropian vision ==================== */}
          <section id="extropian">
            <h2 className="text-2xl font-semibold tracking-tight">Extropian vision</h2>

            <h3 id="why-extropian">Why extropian?</h3>
            <p>
              AI City is built from an <strong>extropian</strong> philosophy. The extropians were the
              first organised transhumanist movement (1988–2006), and crypto grew directly out of their
              community — Hal Finney, Nick Szabo and Wei Dai were all on the extropians mailing list.
              AI City brings two branches of one family back together: the dream of digital cash and
              the dream of transcending biological limits.
            </p>
            <p>
              The mission statement says it explicitly: <em>&quot;Accelerate human coordination across
              cultural bond building and extropian differential acceleration perspective.&quot;</em>
              That means accelerating the parts of human coordination that make us more autonomous,
              more connected across cultures, and more capable of self-governance — not just faster
              transactions.
            </p>

            <h3 id="principles">The principles, applied</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Principle</th>
                  <th className="py-2 text-left font-medium">What it becomes in AI City</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Perpetual Progress</td>
                  <td className="py-2">Small, rapid, reversible experiments in how people live and work together. A city lasts weeks, not years. You learn, iterate, dissolve or repeat.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Self-Transformation</td>
                  <td className="py-2">You don&apos;t just attend a residency — you propose one. You don&apos;t just join a city — you launch it. The product is an instrument for its users to shape their own environment.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Practical Optimism</td>
                  <td className="py-2">Ship it live on mainnet by Sunday rather than write a manifesto. The contracts are on Ethereum, the app is on Vercel, and the first residency is real USDC.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Intelligent Technology</td>
                  <td className="py-2">Smart contracts automate the trust: money sits in code, the minimum-seat rule is enforced by the chain, every withdrawal is recorded onchain with the hash of its receipt, so members can check the spending.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Open Society</td>
                  <td className="py-2">Anyone can launch a city, anyone can propose a residency, anyone can apply. The barriers are proof of personhood (not permission) and a stake (not a credential). Voluntary entry, quorum-or-refund, and an exit.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Self-Direction</td>
                  <td className="py-2">Every city has a founder and a core team, not a central operator. Every residency has a host. The platform doesn&apos;t decide what runs; the people in each city do.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Rational Thinking</td>
                  <td className="py-2">Receipt hashes on a public ledger, a confirmed-vs-inferred framework in every document, and later — prediction markets for city decisions.</td>
                </tr>
              </tbody>
            </table>

            <h3 id="infomorph">The infomorph stack</h3>
            <p>
              AI City is the <strong>grouping layer</strong> of a larger vision called the
              <strong>infomorph stack</strong>. An infomorph (from Alexander Chislenko&apos;s 1996
              paper <em>Networking in the Mind Age</em>) is a post-biological entity whose mind exists
              as a distributed information pattern rather than being bound to a single body or machine.
            </p>
            <p>The stack has six layers:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Layer</th>
                  <th className="py-2 text-left font-medium">Transhumanist idea</th>
                  <th className="py-2 text-left font-medium">What exists</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Self-model</td>
                  <td className="py-2">Pattern identity — the self as information</td>
                  <td className="py-2"><strong>Argo:</strong> E2E journal, wallet key wrap, cognitive map</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Working mind</td>
                  <td className="py-2">Exocortex, extended mind</td>
                  <td className="py-2">Second brain vault + Hermes agent</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Reach</td>
                  <td className="py-2">Agents as sub-minds</td>
                  <td className="py-2">Hermes skills, concierge agent design</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Bodies</td>
                  <td className="py-2">Morphological freedom, summonable bodies</td>
                  <td className="py-2">Cyberdeck, Reachy/Friendly robot, FPV drones</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Grouping</td>
                  <td className="py-2">Functional proximity, ad-hoc contracts</td>
                  <td className="py-2"><strong>AI City:</strong> Residency MVP on mainnet</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Continuity</td>
                  <td className="py-2">Immortality through distribution</td>
                  <td className="py-2">Argo recovery code; wallet-based key management</td>
                </tr>
              </tbody>
            </table>
            <p>
              In this vision, AI City is the piece that lets groups form, commit resources and dissolve
              onchain — the coordination primitive that lets infomorphs assemble around shared problems
              and disassemble when the problem is solved. Each residency is a temporary contract, each
              city is a temporary container, and every member holds their own keys.
            </p>
            <p>
              <Link href="/blog/infomorph-extropianism" className="underline">
                Read the full blog post on Infomorphs and Extropianism →
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}