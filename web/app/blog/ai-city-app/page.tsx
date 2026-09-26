import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI City: A coordination primitive for the network state — AI City",
  description:
    "Pop-up cities on Ethereum mainnet, built from extropian philosophy, the infomorph stack, and the sovereign individual's toolkit. Live today.",
};

export default function AiCityAppPost() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Blog</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          AI City: A coordination primitive for the network state
        </h1>
        <p className="text-lg text-muted">
          Pop-up cities on Ethereum mainnet, built from extropian philosophy, the infomorph stack,
          and the sovereign individual&apos;s toolkit. Live today.
        </p>
        <div className="flex items-center gap-3 text-sm text-muted">
          <time>2026-09-27</time>
          <span>·</span>
          <span>Konrad Gnat</span>
        </div>
      </div>

      <hr className="border-line" />

      <div className="prose prose-sm prose-gray max-w-none space-y-5">
        <p>
          AI City is a product. It lives on Ethereum mainnet, at{" "}
          <a href="https://aicity.cyou">aicity.cyou</a>. You can use it right now: connect your
          wallet, verify with World ID, launch a city, propose a residency, stake USDC for a bed. If
          the residency doesn&apos;t fill, everyone gets their money back.
        </p>

        <p>
          But a product needs a story. Here is the one we are building.
        </p>

        <h2>What the app does</h2>

        <p>
          AI City has two layers. Everything that holds money lives onchain. Everything descriptive
          lives in Postgres and is pinned by a cryptographic hash.
        </p>

        <p>
          A <strong>pop-up city</strong> is a name, a location, a date range, and a core team. It
          lives only in the database. Anyone verified as a unique human can launch one. No gas, no
          transaction — just a form.
        </p>

        <p>
          Inside a city, verified humans propose <strong>residencies</strong>: specific dates, rooms,
          per-bed prices in USDC, a story, and a series. The city&apos;s core team reviews each
          proposal. Once approved, the proposer deploys a <code>Residency</code> contract on Ethereum.
          Every residency gets its own contract, so funds never mix. If one has a bug, it can&apos;t
          touch another&apos;s money.
        </p>

        <p>Guests apply. The host approves each guest for a bed and a price. The guest stakes USDC into that contract. At the deadline:</p>

        <ul>
          <li><strong>Minimum reached</strong> &rarr; the residency becomes Active. The host can withdraw against uploaded receipts. Unspent funds return pro-rata when it closes.</li>
          <li><strong>Minimum not reached</strong> &rarr; everyone gets a full refund. No questions, no disputes, no manual processing.</li>
        </ul>

        <p>
          Your AI agent can do all of this for you. Create an API key on your profile, point your
          agent at <a href="/api/mcp">the MCP server</a>, and it can launch cities, manage proposals,
          review applicants, and edit knowledge bases. You still sign every transaction. The agent
          never holds your wallet.
        </p>

        <h2>Extropianism</h2>

        <p>
          The extropians were the first organised transhumanist movement. Their mailing list included
          Hal Finney, Nick Szabo, and Wei Dai. Crypto and transhumanism grew in the same community,
          in the same decade.
        </p>

        <p>
          Every design choice in AI City maps to an extropian principle:
        </p>

        <ul>
          <li>
            <strong>Perpetual Progress</strong> &rarr; cities last weeks, not years. You learn,
            iterate, dissolve or repeat.
          </li>
          <li>
            <strong>Self-Transformation</strong> &rarr; you don&apos;t just attend a residency, you
            propose one. You don&apos;t just join a city, you launch it.
          </li>
          <li>
            <strong>Open Society</strong> &rarr; the barriers are proof of personhood and a stake,
            not permission or credentials.
          </li>
          <li>
            <strong>Intelligent Technology</strong> &rarr; smart contracts automate the trust. The
            minimum-seat rule is enforced by the chain. Every withdrawal is recorded onchain with the
            hash of its receipt.
          </li>
        </ul>

        <p>
          The mission statement says it explicitly: <em>"Accelerate human coordination across
          cultural bond building and extropian differential acceleration perspective."</em> That is
          not a slogan. It is the design constraint: accelerate the defensive, decentralising,
          human-empowering parts of coordination. Slow down the extractive ones.
        </p>

        <h2>Infomorphism</h2>

        <p>
          In 1996, Alexander Chislenko described the <strong>infomorph</strong> &mdash; a mind that
          exists as a distributed information pattern rather than being bound to a single body or
          machine. His key insight was that high-bandwidth networking makes physical proximity
          unnecessary for cognitive function. Minds will group by <em>purpose</em>, not by{" "}
          <em>location</em>.
        </p>

        <p>
          A pop-up city is exactly that: a group of minds who assemble because they share a problem,
          a place, and a time window. They commit resources through smart contracts. They dissolve
          when the window closes. They fork into new cities when the group divides.
        </p>

        <p>
          AI City is the <strong>grouping layer</strong> of the infomorph stack &mdash; the layer
          between the agent that acts for you (reach) and the recovery code that outlasts you
          (continuity). It is the coordination primitive that lets infomorphs form, commit, and
          dissolve onchain.
        </p>

        <p>
          The full infomorph stack is documented in the{" "}
          <Link href="/blog/infomorph-extropianism" className="underline">
            Infomorphs and Extropianism blog post
          </Link>. It covers all six layers: self-model, working mind, reach, bodies, grouping, and
          continuity.
        </p>

        <h2>The Sovereign Individual</h2>

        <p>
          In 1997, James Dale Davidson and Lord William Rees-Mogg predicted that the information
          revolution would dissolve the nation-state&apos;s monopoly on governance. The sovereign
          individual would hold unprecedented power to choose their jurisdiction, their legal
          framework, and their community.
        </p>

        <p>
          That prediction was 27 years early, but the direction was right. The sovereign individual
          of the 2020s does not need to renounce their passport. They need:
        </p>

        <ul>
          <li>A wallet (self-sovereign identity)</li>
          <li>A World ID (proof of personhood, not permission)</li>
          <li>Enough USDC for a bed (economic agency)</li>
          <li>A city to join (voluntary community)</li>
        </ul>

        <p>
          Everything else &mdash; which rules apply, who else shows up, what the money is spent on
          &mdash; is negotiated, not inherited. The city has a founder and a core team, not a
          government. The residency has a host, not a landlord. The rules are written in Solidity,
          enforced by the chain, and anyone can exit at any time.
        </p>

        <p>
          This is the sovereign individual thesis applied to housing. Not as a metaphor. As a smart
          contract holding your USDC.
        </p>

        <h2>The Network State</h2>

        <p>
          Balaji Srinivasan described the network state as a nation that starts as a newsletter,
          becomes a community, raises a treasury, buys land, and seeks diplomatic recognition. AI
          City compresses that arc into the pop-up city model:
        </p>

        <ol>
          <li>Launch a city (the newsletter phase &mdash; a form, no money)</li>
          <li>Propose residencies (the community phase &mdash; verified humans, shared mission)</li>
          <li>Deploy contracts (the treasury phase &mdash; USDC onchain)</li>
          <li>Fill beds (the land phase &mdash; physical presence, temporary)</li>
          <li>Close or fork (the dissolution phase &mdash; exit, repeat, evolve)</li>
        </ol>

        <p>
          But AI City&apos;s model differs from Balaji&apos;s in one important way. The network state
          in this model is not a single eventual nation. It is a <strong>fleet of small, temporary,
          networked cities</strong> &mdash; each with its own mission, its own treasury, and its own
          exit. The archipelago is the state. It grows by launching more cities, not by conquering
          territory.
        </p>

        <p>
          This is closer to Frederic Bastiat&apos;s idea of the <em>law as voluntary contract</em>{" "}
          than to Hobbes&apos; <em>Leviathan</em>. You opt in. You stake. You leave. The network
          grows because people choose to launch new instances, not because anyone enforces membership.
        </p>

        <h2>What exists today</h2>

        <p>All of the following is live on Ethereum mainnet:</p>

        <ul>
          <li>
            <strong>ResidencyFactory</strong> at{" "}
            <a href="https://etherscan.io/address/0x0Abd146EB01d8b923C2162489E006b7b01C77A57">
              0x0Abd146EB01d8b923C2162489E006b7b01C77A57
            </a>{" "}
            &mdash; deploy your own residency contract
          </li>
          <li>
            <strong>Web app</strong> at{" "}
            <a href="https://aicity.cyou">aicity.cyou</a> &mdash; launch cities, propose residencies,
            apply, stake USDC, withdraw with receipts, claim refunds
          </li>
          <li>
            <strong>World ID</strong> &mdash; Proof of Human via IDKit 4.x, one nullifier per wallet
          </li>
          <li>
            <strong>Agent API</strong> &mdash; MCP server, HTTP API, skill files. Your agent can do
            everything except sign transactions
          </li>
          <li>
            <strong>Door hardware</strong> &mdash; a Pi Zero + servo that opens only for wallets
            staked in an Active residency
          </li>
          <li>
            <strong>Status board</strong> &mdash; a Pi 4 with a 3.5" screen showing live onchain
            state in the common room
          </li>
          <li>
            <strong>30 contract tests</strong> passing (unit, fuzz, invariant, mainnet fork with real
            USDC)
          </li>
        </ul>

        <p>
          The first real test is <strong>Edge City Goa</strong> (October&ndash;November 2026). A
          pop-up city with multiple residencies, a concierge agent grounded in members&apos; second
          brains, a Reachy robot as the house body, and a drone budget funded by the treasury. The
          question to answer: do people actually contribute to a shared mind when their private one
          stays private?
        </p>

        <h2>The one-sentence version</h2>

        <p>
          AI City is a pop-up city launcher on Ethereum mainnet, built from extropian philosophy and
          the infomorph stack, that gives the sovereign individual a coordination primitive for the
          network state &mdash; live today, holding real USDC, for a bed in a hacker house in Goa.
        </p>

        <hr />

        <h3>Further reading</h3>

        <ul>
          <li><Link href="/docs" className="underline">Documentation</Link></li>
          <li><Link href="/blog/infomorph-extropianism" className="underline">Infomorphs and Extropianism</Link></li>
          <li><Link href="/blog/connect-your-agent" className="underline">Connect your AI agent</Link></li>
          <li><Link href="/devlog" className="underline">Devlog</Link></li>
          <li><a href="https://aicity.cyou" className="underline">aicity.cyou</a></li>
        </ul>
      </div>
    </div>
  );
}