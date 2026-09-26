import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connect your AI agent to AI City — AI City",
  description:
    "Give your agent an API key and it can launch cities, propose residencies and apply to them for you over MCP or HTTP. You still sign every transaction.",
};

export default function ConnectYourAgentPost() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Blog</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Connect your AI agent to AI City</h1>
        <p className="text-lg text-muted">
          Give your agent an API key and it can launch cities, propose residencies and apply to them for you. You still
          sign every transaction.
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
          Everything you can do on AI City, your agent can now do for you. That covers launching a pop-up city, running
          its core team, proposing a residency, reviewing applicants, applying for a bed, keeping your profile up to date
          and filling in a residency&apos;s knowledge base. It works with Claude Code, Claude Desktop, Cursor, or any
          agent that can make an HTTP request.
        </p>
        <p>
          One thing doesn&apos;t change: <strong>your agent never holds your wallet.</strong> When money moves, the
          agent prepares the exact transaction and you sign it. The key you give it can&apos;t spend a cent.
        </p>

        <h2>Step 1: create an API key</h2>
        <ol>
          <li>
            Sign in with your wallet and verify with World ID (<Link href="/verify">/verify</Link>). Launching,
            proposing and applying need a verified human, and your agent inherits your status.
          </li>
          <li>
            Open <Link href="/me">your profile</Link> and scroll to <strong>Agent access</strong>.
          </li>
          <li>
            Name the key after the agent that will use it (&quot;Claude on my laptop&quot;) and click{" "}
            <strong>Create key</strong>.
          </li>
          <li>
            Copy the key. It starts with <code>aic_</code> and is shown once. Store it like a password, for example
            in an environment variable:
          </li>
        </ol>
        <pre>
          <code>{`export AICITY_API_KEY=aic_…`}</code>
        </pre>

        <h2>Step 2: connect your agent</h2>

        <h3>Claude Code</h3>
        <pre>
          <code>{`claude mcp add --transport http ai-city https://aicity.cyou/api/mcp \\
  --header "Authorization: Bearer $AICITY_API_KEY"`}</code>
        </pre>
        <p>
          Run <code>/mcp</code> in Claude Code to check that <code>ai-city</code> is connected. You should see 40 tools.
        </p>

        <h3>Claude Desktop, Cursor and other MCP clients</h3>
        <p>Add this to the client&apos;s MCP config, with your key in place of <code>aic_…</code>:</p>
        <pre>
          <code>{`{
  "mcpServers": {
    "ai-city": {
      "type": "http",
      "url": "https://aicity.cyou/api/mcp",
      "headers": { "Authorization": "Bearer aic_…" }
    }
  }
}`}</code>
        </pre>

        <h3>Any other agent: the skill file</h3>
        <p>
          If your agent doesn&apos;t speak MCP, point it at{" "}
          <a href="https://aicity.cyou/skill.md">aicity.cyou/skill.md</a> and give it the key. The skill file describes
          every flow over plain HTTP, and the agent sends the key as <code>Authorization: Bearer aic_…</code>. It&apos;s
          also a standard skill with <code>name</code> and <code>description</code> frontmatter, so you can install it
          into agents that load skills.
        </p>

        <h2>Step 3: ask it to do something</h2>
        <p>Start by checking the connection:</p>
        <blockquote>
          <p>&quot;Use ai-city&apos;s whoami. Am I verified?&quot;</p>
        </blockquote>
        <p>Then give it real work:</p>
        <ul>
          <li>
            <strong>Launch a city.</strong> &quot;Launch a pop-up city called Kuching Builders Month in Kuching,
            Sarawak, from 1 to 30 November. Here&apos;s the mission…&quot; Your agent shows you exactly what it will
            publish before it calls <code>launch_city</code>.
          </li>
          <li>
            <strong>Propose a residency.</strong> &quot;Propose a two-week hacker house in that city: two shared rooms
            with four bunks at 400 USDC each, minimum six guests.&quot; It builds the rooms, beds and prices, checks the
            dates fit inside the city, and submits the proposal to the core team.
          </li>
          <li>
            <strong>Run the city.</strong> &quot;Show me the proposals waiting for review in my city&quot;, then
            &quot;approve #12 with a note&quot;.
          </li>
          <li>
            <strong>Apply.</strong> &quot;Find residencies in Edge City Goa with a private room under 900 USDC and
            apply to the best one with my profile.&quot;
          </li>
          <li>
            <strong>Host.</strong> &quot;Summarise the applicants for my residency and tell me who fits.&quot; You
            decide; the agent carries it out.
          </li>
        </ul>

        <h2>How money works: prepare, sign, record</h2>
        <p>
          Deploying a residency, approving a guest for a bed, paying for your bed, withdrawing against a receipt and
          claiming a refund are all onchain. For each one the agent calls <code>prepare_transaction</code>, and AI City
          returns:
        </p>
        <ul>
          <li>the exact transactions to sign, with a one-line summary of each (&quot;Pay 400 USDC for bed 3&quot;);</li>
          <li>a link to the page where you can do the same thing in one click;</li>
          <li>what the agent should report back once it&apos;s mined.</li>
        </ul>
        <p>
          The server checks the same rules as the contract before building anything: that you&apos;re the host, that
          the residency is still open, that you hold enough USDC, that the price matches what you were approved at. If
          something&apos;s wrong, your agent gets a plain-language reason instead of a failed transaction. You open the
          link, sign in your wallet, and the agent checks the result against the chain.
        </p>
        <p>
          The contracts are unaudited. A good agent will tell you that before you pay, and ours are instructed to.
        </p>

        <h2>What your agent can&apos;t do</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Why it stays with you</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sign in, create or revoke keys</td>
              <td>Proves you own the wallet. A key can&apos;t mint more keys.</td>
            </tr>
            <tr>
              <td>World ID verification</td>
              <td>Proves a unique human over 18. No agent can fake it.</td>
            </tr>
            <tr>
              <td>Sign transactions</td>
              <td>Only your wallet can move your money.</td>
            </tr>
          </tbody>
        </table>
        <p>
          If a key leaks, revoke it under <strong>Agent access</strong>. From the next request on, it&apos;s treated
          as signed out.
        </p>

        <h2>Reference</h2>
        <ul>
          <li>
            <Link href="/docs#agents">Docs: For agents</Link>, covering keys, the MCP server, and the full tool table
          </li>
          <li>
            <a href="/skill.md">/skill.md</a>: the agent skill, with every HTTP call and MCP tool
          </li>
          <li>
            <a href="/skills/mcp.md">/skills/mcp.md</a>: MCP setup and all 40 tools
          </li>
          <li>
            <a href="/skills/transactions.md">/skills/transactions.md</a>: every onchain action, prepare → sign →
            record
          </li>
        </ul>
      </div>
    </div>
  );
}
