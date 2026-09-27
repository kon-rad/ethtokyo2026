import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your private journal as a matchmaker — AI City",
  description:
    "Link your Argo private AI journal to your AI City profile. The concierge asks your journal narrow questions you approve, and uses the answers to find you a co-founder, a partner or an opportunity in your residency and city.",
};

export default function ArgoJournalConciergePost() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Blog</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your private journal as a matchmaker</h1>
        <p className="text-lg text-muted">
          Link Argo, your private AI journal, to your AI City profile. The concierge asks it narrow questions you
          approve, and uses the answers to introduce you to the right people in your residency and your city.
        </p>
        <div className="flex items-center gap-3 text-sm text-muted">
          <time>2026-09-27</time>
          <span>·</span>
          <span>Konrad Gnat</span>
        </div>
      </div>

      <hr className="border-line" />

      <div className="prose prose-sm prose-gray max-w-none">
        <p>
          A residency puts ten or twenty people under one roof for a few weeks. Somewhere in that house is your next
          co-founder, or someone who needs exactly what you know. Most of the time you find out on the last night,
          because nobody had the context to connect you on the first.
        </p>
        <p>
          The context exists. It&apos;s in your journal: what you&apos;re building, what&apos;s stuck, what you wish
          you had a partner for. It&apos;s also the most private thing you own, and it should stay that way. This is
          how AI City and Argo use it without handing it over.
        </p>

        <h2>Two pieces</h2>
        <p>
          <strong>The concierge.</strong> Every city and every residency on AI City has an AI concierge that answers
          from its knowledge base. A residency&apos;s concierge reads its own files and all of its city&apos;s. It
          already knows the house, the dates and who&apos;s coming. See{" "}
          <Link href="/docs#concierge">the docs</Link>.
        </p>
        <p>
          <strong>
            <a href="https://myargoquest.com">Argo</a>.
          </strong>{" "}
          A private, end-to-end encrypted AI journal. Your entries are encrypted with a key only you hold.
        </p>
        <p>Linking the two lets the concierge ask for context without ever reading the journal.</p>

        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Link Argo on your profile.</strong> On <Link href="/me">/me</Link>, under{" "}
            <em>Argo private journal</em>, enter your Argo @username (Argo → Settings → Username). Nothing is shared at
            this point.
          </li>
          <li>
            <strong>Ask the concierge to ask your journal.</strong> Open the concierge on a city or residency page and
            press <strong>Ask my Argo journal</strong>. It sends your Argo four questions: &quot;What are you building
            right now?&quot;, &quot;Who are you hoping to meet here?&quot;, &quot;What could you offer other people
            here?&quot;, &quot;What would you love to talk about, or trade knowledge on?&quot;
          </li>
          <li>
            <strong>You answer in Argo.</strong> The questions land in Argo&apos;s Inbox. Argo drafts an answer to each
            from your journal, on your phone. You edit it, decline it, or send it. Only what you send leaves Argo.
          </li>
          <li>
            <strong>The concierge introduces you.</strong> Your answers come back to AI City signed by Argo&apos;s server
            key, and the concierge reads them next to everyone else&apos;s. Ask it &quot;who should I meet?&quot; and it
            names people and says why each pair fits.
          </li>
        </ol>
        <p>
          The request is signed too. AI City&apos;s concierge has its own wallet key and signs every request with it,
          using Argo&apos;s open <a href="https://myargoquest.com/agents">information request protocol</a>. Any agent
          can use the same protocol, not just this one.
        </p>

        <h2>What it finds</h2>
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A new co-founder</td>
              <td>You need someone technical for a hardware idea; a guest two beds over has shipped firmware for years.</td>
            </tr>
            <tr>
              <td>A new business partner</td>
              <td>You run events; someone in another residency in the same city is building ticketing.</td>
            </tr>
            <tr>
              <td>A new business opportunity</td>
              <td>A host needs a drone video of the house; you fly.</td>
            </tr>
            <tr>
              <td>A trade</td>
              <td>An hour of Solidity review for an hour of pitch practice.</td>
            </tr>
            <tr>
              <td>A topic to discuss</td>
              <td>Three people in the city are all journaling about the same book.</td>
            </tr>
          </tbody>
        </table>

        <h2>What stays private</h2>
        <table>
          <thead>
            <tr>
              <th>The concierge sees</th>
              <th>The concierge never sees</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Answers you sent, to questions you were shown</td>
              <td>Your journal entries</td>
            </tr>
            <tr>
              <td>Your Argo @username</td>
              <td>Your Argo keys or recovery code</td>
            </tr>
          </tbody>
        </table>
        <p>
          The concierge chat is public, so treat what you send as something you&apos;d say to the room. Your profile
          lists every request with its answers. <strong>Remove from concierge</strong> deletes one, and{" "}
          <strong>Unlink</strong> deletes them all.
        </p>

        <h2>Why this belongs in a pop-up city</h2>
        <p>
          AI City is built agent-first. Your agent can already launch a city, apply to a residency and search its
          knowledge base over MCP, and your seat key opens the house door with a signature. Now it matches people too:
          the concierge does the introductions, your journal supplies the context, and you decide what it&apos;s
          allowed to say. Your agent can run the same flow with the <code>ask_my_argo_journal</code> MCP tool.
        </p>

        <h2>Reference</h2>
        <ul>
          <li>
            <Link href="/docs#argo-journal">Docs: Link your Argo journal</Link>
          </li>
          <li>
            <Link href="/docs#knowledge-bases">Docs: Knowledge bases</Link> and the MCP tools for them
          </li>
          <li>
            <Link href="/blog/connect-your-agent">Connect your AI agent to AI City</Link>
          </li>
          <li>
            <a href="https://myargoquest.com">Argo</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
