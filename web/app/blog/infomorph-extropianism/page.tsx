import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Infomorphs and Extropianism — AI City",
  description:
    "Pop-up cities are the grouping layer of the infomorph stack: crypto-native coordination for a post-biological world.",
};

export default function InfomorphExtropianismPost() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Blog</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Infomorphs and Extropianism
        </h1>
        <p className="text-lg text-muted">
          Pop-up cities are the grouping layer of the infomorph stack: crypto-native coordination for
          a post-biological world.
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
          This post is about a vision that spans six layers of technology and philosophy. At the
          bottom is a journal you encrypt yourself. At the top is a city that forks into new cities
          when it dissolves. In the middle is a smart contract that holds USDC for a bed in a
          hacker house. The thread that connects them is the idea that a mind doesn't need a single
          body, a single machine, or even a single lifetime.
        </p>

        <h2>What is an infomorph?</h2>

        <p>
          In 1996, Russian-American computer scientist Alexander Chislenko published a paper called
          <em>Networking in the Mind Age</em>. In it, he described a post-biological entity called an
          <strong>infomorph</strong> — a mind that exists as a distributed information pattern rather
          than being bound to a specific biological organism or dedicated physical hardware.
        </p>

        <p>Chislenko's key ideas were these:</p>

        <ul>
          <li>
            <strong>Functional proximity over physical proximity.</strong> In biological organisms,
            functional components (memory, sensory processing, cognition) must share a single skull to
            avoid signal delays. High-bandwidth networking makes this unnecessary. Mind structures
            will group by <em>purpose</em>, not by <em>location</em>.
          </li>
          <li>
            <strong>The dissolution of the discrete self.</strong> Instead of isolated egos,
            infomorphs operate as modular assemblies of subroutines, knowledge bases, and
            problem-solving agents. A module specialising in quantum mechanics can be shared across
            thousands of cognitive threads.
          </li>
          <li>
            <strong>Transient embodiment.</strong> A physical body is not an identity — it is a
            temporary peripheral. An infomorph can summon, inhabit or dismiss physical manipulators
            (drones, robots, terminals) as needed.
          </li>
          <li>
            <strong>True immortality through distribution.</strong> A decentralised, replicated
            information construct cannot be destroyed by localised trauma.
          </li>
        </ul>

        <p>
          Chislenko saw the internet itself as a primitive infomorph — a distributed intelligence
          where modules interact across arbitrary distances. The "Global Brain" was not a metaphor;
          it was the trajectory.
        </p>

        <h2>The extropians: crypto before crypto</h2>

        <p>
          While Chislenko was writing about infomorphs, another group was building the tools that
          would make them possible. The <strong>extropians</strong> (1988–2006) were the first
          organised transhumanist movement, founded by Max More and Tom Bell. Their principles:
          perpetual progress, self-transformation, practical optimism, intelligent technology, open
          society, self-direction, and rational thinking.
        </p>

        <p>
          The extropians mailing list included Hal Finney, Nick Szabo and Wei Dai. Finney wrote about
          DigiCash for <em>Extropy</em> magazine in 1993. Szabo wrote for the magazine in 1995. Dai
          published b-money in 1998 — the first citation in the Bitcoin whitepaper. Finney received
          the first bitcoin transaction in 2009.
        </p>

        <p>
          <strong>The cypherpunks and the extropians were the same people.</strong> The dream of
          digital cash and the dream of transcending biology grew in the same community, on the same
          mailing list, in the same decade. AI City is not a mashup of two cultures. It is a reunion
          of two branches of one family.
        </p>

        <h2>The infomorph stack</h2>

        <p>
          An infomorph needs several layers to function. Here is the stack we are building, from the
          innermost layer to the outermost:
        </p>

        <table>
          <thead>
            <tr>
              <th>Layer</th>
              <th>Transhumanist idea</th>
              <th>Crypto primitive</th>
              <th>What exists</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Self-model</strong></td>
              <td>Pattern identity — the self as information</td>
              <td>Zero-knowledge encryption, wallet key wrap</td>
              <td>Argo: E2E journal, cognitive map</td>
            </tr>
            <tr>
              <td><strong>Working mind</strong></td>
              <td>Exocortex, extended mind</td>
              <td>Self-hosted compute, keys you hold</td>
              <td>Second brain vault, Hermes agent</td>
            </tr>
            <tr>
              <td><strong>Reach</strong></td>
              <td>Chislenko's sub-minds and modules</td>
              <td>Delegated keys, agent payments (x402)</td>
              <td>Hermes skills, concierge design</td>
            </tr>
            <tr>
              <td><strong>Bodies</strong></td>
              <td>Morphological freedom, summonable bodies</td>
              <td>Device certificates, signed commands</td>
              <td>Cyberdeck, Reachy robot, FPV drones</td>
            </tr>
            <tr>
              <td><strong>Grouping</strong></td>
              <td>Functional proximity, ad-hoc contracts</td>
              <td>Smart contract treasury, proof of personhood</td>
              <td><strong>AI City:</strong> Residency MVP on mainnet</td>
            </tr>
            <tr>
              <td><strong>Continuity</strong></td>
              <td>Immortality through distribution</td>
              <td>Social recovery, timelocks, distributed storage</td>
              <td>Wallet key management, recovery codes</td>
            </tr>
          </tbody>
        </table>

        <p>
          AI City is the <strong>grouping layer</strong>. It is the coordination primitive that lets
          infomorphs assemble around shared problems, commit resources, and dissolve when the problem
          is solved. Each residency is a temporary contract. Each city is a temporary container. Every
          member holds their own keys.
        </p>

        <h2>Why pop-up cities?</h2>

        <p>
          Chislenko predicted that minds would group by <em>functional purpose</em>, not physical
          location. A pop-up city is exactly that: a group of people who assemble because they share a
          problem, a place, and a time window, then dissolve when the window closes.
        </p>

        <p>The design choices reflect the philosophy:</p>

        <ul>
          <li>
            <strong>One contract per residency.</strong> Funds never mix, and a bug in one contract
            can't touch another. This is Chislenko's modularity applied to money.
          </li>
          <li>
            <strong>Quorum-or-refund.</strong> The residency only activates if enough people commit.
            If it doesn't fill, everyone gets their money back. This is extropian spontaneous order:
            voluntary coordination with a minimum threshold.
          </li>
          <li>
            <strong>Proof of personhood, not proof of identity.</strong> World ID tells us "this is
            one unique human" — not their name, nationality, or document. This is the minimum
            sufficient assurance for a scarce bed.
          </li>
          <li>
            <strong>Metadata offchain, money onchain.</strong> Descriptive data is pinned by a hash,
            not stored on the contract. This keeps gas costs low and the contracts simple.
          </li>
        </ul>

        <h2>Extropian differential acceleration</h2>

        <p>
          The mission statement says we want to "accelerate human coordination across cultural bond
          building and extropian differential acceleration perspective." This is a mouthful on purpose
          — it forces you to stop and think.
        </p>

        <p>
          <strong>Differential acceleration</strong> (from the d/acc movement, popularised by Vitalik
          Buterin) means: not all acceleration is good. Accelerate the defensive, decentralising,
          human-empowering technologies. Slow down the centralising, extractive, replace-human ones.
        </p>

        <p>In practice, this means:</p>

        <ul>
          <li>Agents are delegates, never citizens — no seats, no keys, capped spending</li>
          <li>Privacy is structure, not aspiration — zero-knowledge journal, encrypted membrane</li>
          <li>Exit is always available — anyone can close a residency after the end date</li>
          <li>Access should broaden, not narrow — a manual approval path now, practice-weighted
          access later</li>
        </ul>

        <p>
          The extropian principles already lean this way. Max More's 2003 version of the principles
          framed intelligent technology as a <em>means</em>, "not as ends in themselves." The 2026
          amendment is to make that explicit: build defensive tech first, and let the offensive stuff
          wait.
        </p>

        <h2>What's real now</h2>

        <p>
          The pieces that exist today and can be used:
        </p>

        <ul>
          <li>
            <strong>AI City contracts</strong> on Ethereum mainnet — the factory and per-residency
            escrow. 24 tests passing, including a mainnet fork test against real USDC.
          </li>
          <li>
            <strong>The web app</strong> — launch a city, propose a residency, apply for a bed, stake
            USDC, withdraw with receipts, claim refunds. All with SIWE sessions and World ID Proof of
            Human.
          </li>
          <li>
            <strong>Argo</strong> — the zero-knowledge journal with a wallet-derived key wrap. The
            self-model layer, running today.
          </li>
          <li>
            <strong>Hermes</strong> — the agent that runs the second brain, the concierge, and
            Friendly the robot. The working mind and reach layers.
          </li>
          <li>
            <strong>The cyberdeck, Reachy, and the drone fleet</strong> — the body layer, in various
            stages of integration.
          </li>
        </ul>

        <h2>What comes next</h2>

        <p>
          The roadmap is structured around real deadlines — not milestones:
        </p>

        <ul>
          <li>
            <strong>Edge City Goa (Oct–Nov 2026):</strong> the first real test of the stack. A city
            vault, concierge agents grounded in members' second brains, intents exported from Argo,
            Reachy as the house robot, and a drone budget funded by the treasury. The question to
            answer: do people actually contribute to a shared mind when their private one stays
            private?
          </li>
          <li>
            <strong>2027:</strong> ZK practice proofs for weighted access (prove "I journaled 300
            days" without revealing the entries), journal inheritance (Shamir shares + timelock),
            multi-city persona management, and cities that fork at close.
          </li>
          <li>
            <strong>Beyond:</strong> an archipelago of many small cities sharing a skill library and
            an alumni graph. Portable infomorphs that move with you from city to city. A city compute
            box that runs every member's private model with per-member encryption.
          </li>
        </ul>

        <h2>The one-sentence version</h2>

        <p>
          Extropianism supplied the goals (self-transformation, open-ended progress, voluntary order),
          cypherpunk crypto supplied the tools, and d/acc supplies the guardrails. AI City is the
          grouping layer of an infomorph — a coordination primitive you can deploy today, on Ethereum
          mainnet, with real USDC, for a bed in a hacker house in Goa.
        </p>

        <hr />

        <h3>Further reading</h3>

        <ul>
          <li><Link href="/docs" className="underline">AI City Documentation</Link></li>
          <li><Link href="/devlog" className="underline">AI City Devlog</Link></li>
          <li>
            <a href="https://archiv.telepolis.de/features/Networking-in-the-Mind-Age-3445849.html" className="underline">
              Chislenko, <em>Networking in the Mind Age</em> (1996)
            </a>
          </li>
          <li>
            <a href="http://www.mrob.com/pub/religion/extro_prin.html" className="underline">
              Max More, <em>The Extropian Principles</em> v3.0 (1998)
            </a>
          </li>
          <li>
            <a href="https://lifeboat.com/ex/the.principles.of.extropy" className="underline">
              Max More, <em>Principles of Extropy</em> v3.11 (2003)
            </a>
          </li>
          <li>
            <a href="https://www.youtube.com/watch?v=AQA7BUtqm1I" className="underline">
              Vitalik Buterin vs Guillaume Verdon, d/acc vs e/acc debate
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}