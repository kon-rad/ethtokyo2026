import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";
import { addressUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Smart contracts — AI City Docs",
  description:
    "Function-by-function reference for the ResidencyFactory and Residency contracts: who can call what, when, and what it does with your USDC.",
};

type Fn = {
  id: string;
  signature: string;
  caller: string;
  when: string;
  purpose: string;
  details?: string[];
  reverts?: string[];
  emits?: string;
};

const factoryFns: Fn[] = [
  {
    id: "createResidency",
    signature: "createResidency(ResidencyParams p) returns (address residency)",
    caller: "Anyone",
    when: "Any time",
    purpose:
      "Deploys a new Residency contract with the caller as its host. Each residency is its own contract, so funds from different stays never mix.",
    details: [
      "The app only lists residencies deployed from an approved proposal: the server decodes the event and checks the metadata hash, dates and seats against the proposal before recording it.",
      "The new address is appended to the factory's list, so every residency ever launched can be enumerated onchain.",
    ],
    reverts: ["InvalidParams (from the Residency constructor) if the dates or seat counts break the rules below."],
    emits: "ResidencyCreated(residency, host, metadataHash, startTime, endTime, deadline, minSeats, maxSeats)",
  },
  {
    id: "residenciesLength",
    signature: "residenciesLength() view returns (uint256)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "How many residencies the factory has deployed.",
  },
  {
    id: "residencyAt",
    signature: "residencyAt(uint256 index) view returns (address)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "The residency deployed at position index (0-based, in launch order). Reverts past the end of the list.",
  },
  {
    id: "factory-usdc",
    signature: "usdc() view returns (address)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "The USDC token every residency from this factory accepts. Fixed at factory deploy.",
  },
];

const hostFns: Fn[] = [
  {
    id: "approve",
    signature: "approve(address member, uint32 bedId, uint256 price)",
    caller: "Host only",
    when: "Open",
    purpose:
      "Approves a wallet for a specific bed at a specific price (USDC with 6 decimals, so 1,400 USDC is 1400000000). Approval is what lets the member stake.",
    details: [
      "Re-approving a member who hasn't paid yet moves them to the new bed and price and frees their old bed.",
      "One bed holds one member. Approving someone for a bed another wallet holds reverts.",
      "The host can approve more people than maxSeats. Seats go to whoever pays first.",
    ],
    reverts: [
      "NotHost, WrongStatus",
      "InvalidMember: zero address or zero price",
      "AlreadyStaked: the member has already paid",
      "BedTaken(bedId, holder): another wallet holds that bed",
    ],
    emits: "Approved(member, bedId, price)",
  },
  {
    id: "revoke",
    signature: "revoke(address member)",
    caller: "Host only",
    when: "Open",
    purpose: "Withdraws an approval that hasn't been paid yet and frees the bed. A member who has staked can't be revoked.",
    reverts: ["NotHost, WrongStatus", "NotApproved: nothing to revoke", "AlreadyStaked: the member has paid"],
    emits: "Revoked(member, bedId)",
  },
  {
    id: "cancel",
    signature: "cancel()",
    caller: "Host only",
    when: "Open",
    purpose:
      "Calls the residency off before the deadline. The status becomes Failed permanently, and every staker can claim a full refund.",
    reverts: ["NotHost, WrongStatus"],
    emits: "Cancelled()",
  },
  {
    id: "withdraw",
    signature: "withdraw(uint256 amount, bytes32 receiptHash, string note)",
    caller: "Host only",
    when: "Active",
    purpose:
      "Sends amount USDC from the residency to the host to pay for the stay, recording the sha256 of the receipt file and a short note onchain.",
    details: [
      "The contract doesn't check the receipt. It records the hash so anyone can match the uploaded file against it. The app rejects receipt uploads whose hash doesn't match the Withdrawn event.",
      "The host can withdraw any amount up to the full balance, in one or more withdrawals, from the moment the deadline passes. See the trust model below.",
      "The note is capped at 280 bytes.",
    ],
    reverts: [
      "NotHost, WrongStatus",
      "InvalidAmount: zero, or more than the balance",
      "NoteTooLong: note over 280 bytes",
    ],
    emits: "Withdrawn(amount, receiptHash, note)",
  },
  {
    id: "close",
    signature: "close()",
    caller: "Host any time; anyone after endTime",
    when: "Active",
    purpose:
      "Ends an Active residency. The balance at that moment is frozen as closedBalance and each staker can claim their share of it.",
    details: [
      "Anyone can close after the end date, so a host who disappears can't lock the leftovers.",
      "After close there are no more withdrawals.",
    ],
    reverts: ["WrongStatus", "CloseNotAllowed: a non-host called before endTime"],
    emits: "Closed(closedBalance)",
  },
  {
    id: "sweep",
    signature: "sweep()",
    caller: "Host only",
    when: "Closed, 180 days after close()",
    purpose:
      "Sends everything still in the contract to the host: shares nobody claimed, rounding dust, and USDC sent here by mistake. Members have 180 days after closing to claim before their share can be swept.",
    details: [
      "After a sweep, claimable() returns 0 and claim() reverts for anyone who hadn't claimed.",
      "A Failed residency can never be swept. Every refund stays claimable forever.",
    ],
    reverts: ["NotHost, WrongStatus", "SweepTooEarly(availableAt): less than 180 days since close", "InvalidAmount: nothing to sweep"],
    emits: "Swept(amount)",
  },
  {
    id: "transferHost",
    signature: "transferHost(address newHost)",
    caller: "Host only",
    when: "Any time",
    purpose:
      "Offers the host role to another wallet. Nothing changes until that wallet calls acceptHost(). Pass the zero address to cancel a pending offer.",
    details: ["Use it to rotate a host key, or to hand a residency to a co-organizer."],
    reverts: ["NotHost"],
    emits: "HostTransferStarted(currentHost, newHost)",
  },
  {
    id: "acceptHost",
    signature: "acceptHost()",
    caller: "The pending host",
    when: "Any time",
    purpose:
      "Completes a host transfer. The caller becomes the host, with every host power and future withdrawals, and the previous host loses them. The two steps mean a typo'd address can never become the host.",
    reverts: ["NotPendingHost: the caller isn't the offered wallet"],
    emits: "HostTransferred(previousHost, newHost)",
  },
];

const memberFns: Fn[] = [
  {
    id: "stake",
    signature: "stake(uint256 expectedPrice)",
    caller: "An approved member",
    when: "Open",
    purpose:
      "Pays your approved price into the residency and takes a seat. You need to approve the residency to spend that much USDC first. The app does this as step 1 of 2.",
    details: [
      "expectedPrice is the price you saw and agreed to. If the host re-approved you at a different price before your transaction landed, stake reverts with PriceChanged instead of charging you the new amount.",
      "Once staked, you can't be revoked or moved to another bed, and you can't unstake. Your way out is a refund if the residency fails or is cancelled.",
    ],
    reverts: [
      "WrongStatus: past the deadline, or cancelled",
      "NotApproved, AlreadyStaked",
      "PriceChanged(currentPrice): your approved price isn't expectedPrice",
      "ResidencyFull: maxSeats already paid",
    ],
    emits: "Staked(member, bedId, price, seatNumber)",
  },
  {
    id: "claim",
    signature: "claim()",
    caller: "A member who staked",
    when: "Failed or Closed",
    purpose: "Pays out whatever claimable(you) returns, once. Full refund if Failed; your pro-rata share of leftovers if Closed.",
    reverts: ["NothingToClaim: not staked, already claimed, or the residency is Open or Active"],
    emits: "Claimed(member, amount)",
  },
];

const viewFns: Fn[] = [
  {
    id: "status",
    signature: "status() view returns (Status)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose:
      "The current state, computed from the clock and flags rather than stored: Closed if closed; Failed if cancelled; Open before the deadline; then Active if seatCount ≥ minSeats, otherwise Failed.",
  },
  {
    id: "getMember",
    signature: "getMember(address account) view returns (Member)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "A wallet's record: approved, staked, claimed, bedId and price. The app uses staked to gate who can download receipts.",
  },
  {
    id: "claimable",
    signature: "claimable(address account) view returns (uint256)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose:
      "What claim() would pay this wallet right now. Failed: the full price paid. Closed: closedBalance × price ÷ totalStaked, until the host sweeps. Otherwise, or if already claimed: 0.",
  },
  {
    id: "balance",
    signature: "balance() view returns (uint256)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "The residency's current USDC balance.",
  },
  {
    id: "bedHolder",
    signature: "bedHolder(uint32 bedId) view returns (address)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "Which wallet holds a bed, approved or staked. Zero address if the bed is free.",
  },
  {
    id: "pendingHost",
    signature: "pendingHost() view returns (address)",
    caller: "Anyone (read-only)",
    when: "Any time",
    purpose: "The wallet offered the host role by transferHost(). Zero address if no transfer is pending.",
  },
];

const stateVars: [string, string][] = [
  ["host", "The wallet that called createResidency, until it hands over with transferHost()."],
  ["pendingHost", "The wallet offered the host role, waiting to accept."],
  ["usdc", "The token this residency accepts."],
  ["metadataHash", "keccak256 of the canonical listing JSON (name, rooms, prices, organizers, city). Edits made after deploy are detectable."],
  ["startTime / endTime", "When the stay runs (unix seconds). At least 7 days apart."],
  ["deadline", "Last moment to stake. Must be in the future at deploy and no later than startTime."],
  ["minSeats / maxSeats", "Paid seats needed for the residency to go ahead, and the cap. 1 ≤ min ≤ max ≤ 500."],
  ["seatCount", "How many members have staked."],
  ["totalStaked", "Sum of all stakes. The denominator for pro-rata leftovers."],
  ["totalWithdrawn", "Sum of all host withdrawals."],
  ["closedBalance", "Balance frozen at close(). What leftovers are split from."],
  ["cancelled / closed", "Flags set by cancel() and close()."],
  ["closedAt", "When close() was called. The sweep window counts from here."],
  ["swept", "Set by sweep(). Once true, leftover claims are over."],
  ["MIN_DURATION / MAX_SEATS / MAX_NOTE_LENGTH / SWEEP_DELAY", "Constants: 7 days, 500 seats, 280 bytes, 180 days."],
];

const errors: [string, string][] = [
  ["NotHost()", "A host-only function was called by someone else."],
  ["InvalidParams()", "Constructor rules broken: zero host or token, duration under 7 days, deadline in the past or after start, bad seat counts."],
  ["WrongStatus(current)", "The function isn't allowed in the current status. Carries the status it found."],
  ["InvalidMember()", "approve() with a zero address or zero price."],
  ["BedTaken(bedId, holder)", "Another wallet holds that bed."],
  ["NotApproved()", "stake() or revoke() on a wallet with no approval."],
  ["AlreadyStaked()", "Double stake, or trying to change or revoke a paid member."],
  ["ResidencyFull()", "maxSeats already paid."],
  ["NothingToClaim()", "claim() when claimable() is 0."],
  ["InvalidAmount()", "withdraw() of zero or more than the balance."],
  ["NoteTooLong()", "withdraw() note over 280 bytes."],
  ["CloseNotAllowed()", "A non-host called close() before endTime."],
  ["PriceChanged(currentPrice)", "stake() was sent with a price that no longer matches your approval."],
  ["NotPendingHost()", "acceptHost() from a wallet that wasn't offered the role."],
  ["SweepTooEarly(availableAt)", "sweep() before 180 days have passed since close()."],
];

function FnCard({ fn }: { fn: Fn }) {
  return (
    <div id={fn.id} className="not-prose scroll-mt-24 rounded-xl border border-line p-4">
      <code className="block overflow-x-auto whitespace-pre text-sm font-semibold">{fn.signature}</code>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">Caller: {fn.caller}</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">Status: {fn.when}</span>
      </div>
      <p className="mt-3 text-sm">{fn.purpose}</p>
      {fn.details && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {fn.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {fn.reverts && (
        <p className="mt-3 text-xs text-muted">
          <span className="font-medium text-foreground">Reverts:</span> {fn.reverts.join(" · ")}
        </p>
      )}
      {fn.emits && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground">Emits:</span> <code>{fn.emits}</code>
        </p>
      )}
    </div>
  );
}

function FnGroup({ title, fns }: { title: string; fns: Fn[] }) {
  return (
    <>
      <h4 className="font-semibold">{title}</h4>
      <div className="space-y-3">
        {fns.map((fn) => (
          <FnCard key={fn.id} fn={fn} />
        ))}
      </div>
    </>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <tr className="border-b border-line">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 break-all">
        {config.explorerUrl ? (
          <a href={addressUrl(address)} className="underline" target="_blank" rel="noreferrer">
            <code>{address}</code>
          </a>
        ) : (
          <code>{address}</code>
        )}
      </td>
    </tr>
  );
}

const toc = [
  { id: "overview", title: "Overview" },
  { id: "addresses", title: "Deployed addresses" },
  { id: "lifecycle", title: "Lifecycle" },
  { id: "factory", title: "ResidencyFactory" },
  { id: "residency", title: "Residency" },
  { id: "events", title: "Events and errors" },
  { id: "trust", title: "Trust model and known limits" },
];

export default function ContractsDocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div>
        <p className="text-sm text-muted">
          <Link href="/docs" className="underline">
            Docs
          </Link>{" "}
          / Smart contracts
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Smart contracts</h1>
        <p className="mt-2 text-muted">
          Every function in the two contracts that hold residency money: who can call it, when, and what it does.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24">
            <ul className="space-y-1 border-l border-line pl-3">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-sm text-muted hover:text-foreground">
                    {t.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="prose prose-sm prose-gray max-w-none space-y-12">
          <section id="overview" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
            <p>
              AI City has two contracts, written in Solidity 0.8.28 with OpenZeppelin&apos;s <code>SafeERC20</code> and{" "}
              <code>ReentrancyGuard</code>. There&apos;s no proxy, no upgrade key and no platform admin. The only
              privileged wallet is each residency&apos;s own host.
            </p>
            <ul>
              <li>
                <strong>ResidencyFactory</strong> is deployed once per chain. It launches residencies and keeps a list
                of them.
              </li>
              <li>
                <strong>Residency</strong> is one contract per stay. It&apos;s an escrow for seats: the host approves
                members for beds at a price, members stake that price in USDC before a deadline, and the minimum-seat rule
                decides whether the money goes to the host or back to the members.
              </li>
            </ul>
            <p>
              Cities, proposals, room names and profiles live offchain in Postgres. The chain only holds money and a hash
              of the listing.
            </p>
            <p className="text-sm">
              <strong>Unaudited.</strong> Only stake what you can afford to lose.
            </p>
          </section>

          <section id="addresses" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight">Deployed addresses</h2>
            <p>
              Network: <strong>{config.chain.name}</strong> (chain id {config.chain.id}). Each residency&apos;s own
              address is shown on its page at <code>/r/[address]</code>.
            </p>
            <table className="w-full text-sm">
              <tbody>
                <AddressRow label="ResidencyFactory" address={config.factoryAddress} />
                <AddressRow label="USDC" address={config.usdcAddress} />
              </tbody>
            </table>
          </section>

          <section id="lifecycle" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight">Lifecycle</h2>
            <pre className="overflow-x-auto rounded-xl border border-line bg-gray-50 p-4 text-xs">
{`  Open ── approve · revoke · stake
   │
   ├─ host calls cancel() ──────────────▶ Failed ── claim(): full refund
   │
   └─ deadline passes
        ├─ seats < minSeats ────────────▶ Failed ── claim(): full refund
        └─ seats ≥ minSeats ──▶ Active ── withdraw() (host, repeatable)
                                  │
                                  └─ close() ──▶ Closed ── claim(): pro-rata leftovers
                                                          sweep() after 180 days (host)

  Any status: transferHost() → acceptHost() hands the host role to another wallet.`}
            </pre>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Host can</th>
                  <th className="py-2 text-left font-medium">Members can</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Open</td>
                  <td className="py-2">approve, revoke, cancel</td>
                  <td className="py-2">stake</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Active</td>
                  <td className="py-2">withdraw, close</td>
                  <td className="py-2">wait; anyone can close after endTime</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Failed</td>
                  <td className="py-2">nothing</td>
                  <td className="py-2">claim a full refund</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 font-medium">Closed</td>
                  <td className="py-2">sweep what&apos;s unclaimed after 180 days</td>
                  <td className="py-2">claim a pro-rata share of what&apos;s left, within 180 days</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="factory" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">ResidencyFactory</h2>
            <p>
              Launches residencies. The host of each new residency is whoever calls <code>createResidency</code>.
            </p>
            <h4 className="font-semibold">ResidencyParams</h4>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>bytes32 metadataHash</code></td><td className="py-2">Hash of the listing JSON</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>uint64 startTime, endTime</code></td><td className="py-2">Stay dates; endTime − startTime ≥ 7 days</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>uint64 deadline</code></td><td className="py-2">Last moment to stake; now &lt; deadline ≤ startTime</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>uint32 minSeats, maxSeats</code></td><td className="py-2">1 ≤ minSeats ≤ maxSeats ≤ 500</td></tr>
              </tbody>
            </table>
            <FnGroup title="Functions" fns={factoryFns} />
          </section>

          <section id="residency" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Residency</h2>
            <p>
              One seat escrow per stay. All parameters are fixed at deploy. The status is computed from the clock and
              two flags, so nobody has to call anything for the deadline to take effect.
            </p>
            <h4 className="font-semibold">State</h4>
            <table className="w-full text-sm">
              <tbody>
                {stateVars.map(([name, desc]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="py-2 pr-4 align-top"><code>{name}</code></td>
                    <td className="py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <FnGroup title="Host functions" fns={hostFns} />
            <FnGroup title="Member functions" fns={memberFns} />
            <FnGroup title="Views" fns={viewFns} />
          </section>

          <section id="events" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight">Events and errors</h2>
            <p>
              The app reads these events to record launches and match receipts. You can read the same events on a
              block explorer to audit any residency without trusting the app.
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>ResidencyCreated</code></td><td className="py-2">Factory launched a residency</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Approved / Revoked</code></td><td className="py-2">Host changed a bed assignment</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Staked</code></td><td className="py-2">A member paid; includes their seat number</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Cancelled</code></td><td className="py-2">Host called it off</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Withdrawn</code></td><td className="py-2">Host took funds; includes the receipt hash and note</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Closed</code></td><td className="py-2">Residency ended; includes the balance being split</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Claimed</code></td><td className="py-2">A member took a refund or their leftovers</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>HostTransferStarted / HostTransferred</code></td><td className="py-2">Host role offered, then accepted</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4"><code>Swept</code></td><td className="py-2">Host collected leftovers 180 days after close</td></tr>
              </tbody>
            </table>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Error</th>
                  <th className="py-2 text-left font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {errors.map(([name, desc]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="py-2 pr-4 align-top"><code>{name}</code></td>
                    <td className="py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="trust" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight">Trust model and known limits</h2>
            <p>What the contract guarantees:</p>
            <ul>
              <li>No one can take money while the residency is Open, including the host.</li>
              <li>You never pay more than the price you passed to <code>stake()</code>.</li>
              <li>If the minimum isn&apos;t met, or the host cancels, every staker gets back exactly what they paid.</li>
              <li>Funds from one residency can&apos;t touch another&apos;s.</li>
              <li>Refunds are pull-based, so one member&apos;s failed transfer can&apos;t block anyone else.</li>
              <li>If the host disappears, anyone can close after the end date and members claim what&apos;s left.</li>
            </ul>
            <p>What it doesn&apos;t guarantee, so you know what you&apos;re trusting the host with:</p>
            <ul>
              <li>
                <strong>Once Active, the host controls the money.</strong> From the moment the deadline passes, even
                before the stay starts, the host can withdraw the whole balance. Receipts make spending visible;
                they don&apos;t prove it, and the contract doesn&apos;t check them.
              </li>

              <li>
                <strong>World ID and bed lists aren&apos;t checked onchain.</strong> The app checks them. Onchain, the
                host&apos;s <code>approve</code> is the gate.
              </li>
              <li>
                <strong>Claim leftovers within 180 days.</strong> After that the host can sweep whatever is unclaimed
                from a closed residency. Refunds from a failed residency are never sweepable.
              </li>
              <li>
                <strong>A lost host key still can&apos;t be recovered.</strong> The host can hand over the role while
                they control the key, but nobody can take it from them. Members are still protected by the deadline and
                the anyone-can-close rule.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
