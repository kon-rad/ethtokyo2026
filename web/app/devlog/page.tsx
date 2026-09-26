import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Devlog — AI City",
  description: "The build journal for AI City: what we shipped, what broke, and what comes next.",
};

const entries = [
  {
    date: "2026-09-26",
    title: "Day 1: contracts, schema, and the city layer",
    body: `ETHGlobal Tokyo started today. By the evening we had:

- **Residency.sol** and **ResidencyFactory.sol** — the core contracts. One factory deploys one Residency per stay. Funds never mix.
- **22 unit tests + fuzz + invariant suite + mainnet fork test** — all passing against real USDC on a mainnet fork.
- **Database schema** — users, profiles, cities, core team, residency series, proposals, residencies, applications, receipts. Every onchain event has its corresponding table row.
- **SIWE auth** — Sign-In with Ethereum, session cookies signed with jose.
- **World IDKit 4.x** — Proof of Human widget, server-side RP signing, developer API verification, one nullifier per wallet.

The big design decision: cities are offchain containers (Postgres), and residencies are onchain contracts. This means launching a city is free (no gas), and each residency's money is isolated in its own contract.

The city layer was a late addition — the original design had cities as metadata-only. The offchain city with a core team that approves proposals turned out to be the right abstraction: it decouples city governance from onchain risk.`,
    tags: ["contracts", "architecture", "identity"],
  },
  {
    date: "2026-09-27",
    title: "Day 2: the web app, API routes, and the extropian mission",
    body: `All the API routes are live:

- **Auth:** nonce, verify, logout, me
- **World ID:** rp-context, verify, dev-verify
- **Cities:** CRUD, core team management, proposals
- **Residencies:** deploy recording, applications, approvals, receipts
- **Profiles:** read, update, photo upload
- **Directory:** paginated listing with search and city filter

The frontend pages are built and styled — Luma-inspired design with white backgrounds, generous whitespace, rounded cards, and gradient covers generated from each city/residency name (no image uploads needed).

Pages: home (/), launch, cities (listing + detail + manage + propose), proposals, residency (detail + manage + apply), series, people (directory + profile), me (profile edit), verify.

The mission statement was written: *"Accelerate human coordination across cultural bond building and extropian differential acceleration perspective."* This is not marketing copy — it's a design constraint. Every feature was checked against whether it makes coordination easier, more reversible, or more voluntary.`,
    tags: ["frontend", "api", "design"],
  },
  {
    date: "2026-09-27",
    title: "World ID integration: no Orb needed",
    body: `We integrated World ID Proof of Human via IDKit 4.x. Key takeaways:

- **No Orb verification required.** The World App's built-in uniqueness check is enough. You scan a QR code, the app generates a Proof of Human, the server verifies it against World's developer API.
- **One nullifier per wallet.** The UNIQUE constraint on users.nullifier means trying to use the same World ID with a second wallet returns a 409 error.
- **Self-attested 18+.** World's minimum_age Identity Check is in preview. For now, the user checks a box. We'll swap it in when World grants access.
- **Server-side RP signing.** The RP signing key never leaves the server. The client gets a signed context, sends the proof, and the server forwards it to developer.world.org/api/v4/verify.

The full debrief is in docs/WORLD-IDKIT-DEBRIEF.md.`,
    tags: ["identity", "world-id"],
  },
  {
    date: "2026-09-27",
    title: "The infomorph stack: why this isn't just a booking app",
    body: `AI City is the grouping layer of a larger vision. Read the full vision:

- [Infomorph Stack Vision](/blog/infomorph-extropianism)
- [Docs: Extropian Vision](/docs#extropian)

The short version: an infomorph is a mind that exists as a distributed information pattern rather than being bound to a single body. Chislenko wrote about this in 1996. The extropians — who were also the cypherpunks — built the tools. AI City is the onchain grouping layer: a coordination primitive that lets infomorphs assemble around shared problems and dissolve when the problem is solved.

The roadmap:
1. **Now:** Residency MVP on mainnet (this weekend)
2. **Edge City Goa (Oct–Nov 2026):** City vault, concierge agents, Reachy as house robot, drone budget
3. **2027:** ZK practice proofs, journal inheritance, multi-city personas, cities that fork`,
    tags: ["vision", "extropian", "infomorph"],
  },
];

export default function DevlogPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Devlog</h1>
        <p className="mt-2 text-muted">
          The build journal for AI City. What we shipped, what broke, and what comes next.
        </p>
      </div>

      <div className="space-y-10">
        {entries.map((entry) => (
          <article key={entry.date + entry.title} className="space-y-3">
            <div className="flex items-center gap-3">
              <time className="text-sm font-medium text-muted">{entry.date}</time>
              <div className="flex gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">{entry.title}</h2>
            <div className="prose prose-sm prose-gray max-w-none">
              {entry.body.split("\n\n").map((p, i) => {
                if (p.startsWith("- **")) {
                  return (
                    <ul key={i}>
                      {p.split("\n").map((li, j) => (
                        <li key={j}>{li.replace(/^- \*\*(.+?)\*\*/, "$1 — ")}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={i}>{p}</p>;
              })}
            </div>
            <hr className="border-line" />
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="font-medium">More coming soon</p>
        <p className="mt-1 text-sm text-muted">
          Follow <a href="https://x.com/konradgnat" className="underline">@konradgnat</a> for updates,
          or check the <Link href="/docs" className="underline">docs</Link> for the full architecture.
        </p>
      </div>
    </div>
  );
}