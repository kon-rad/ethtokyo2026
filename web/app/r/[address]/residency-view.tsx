"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import type { Address } from "viem";
import { residencyAbi, erc20Abi } from "@/lib/abi";
import { config } from "@/lib/config";
import { allBeds } from "@/lib/metadata";
import { api } from "@/lib/client/api";
import { useTx } from "@/lib/client/use-tx";
import { useResidencyChain } from "@/lib/client/use-residency";
import { addressUrl, durationLabel, formatUsdc, shortAddress, txUrl } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/status";
import type { ResidencyDto } from "@/lib/server/residencies";
import { Cover, statusTone } from "@/components/residency-card";
import { Countdown, LocalDate } from "@/components/countdown";
import { useSession } from "@/components/session";
import { Button, Card, LinkButton, Notice, Pill, SeatsBar } from "@/components/ui";
import { ConciergePanel } from "@/components/concierge-panel";

type Application = { id: number; status: "pending" | "approved" | "denied" } | null;
type ReceiptRow = { id: number; tx_hash: string; filename: string };

export function ResidencyView({ residency }: { residency: ResidencyDto }) {
  const address = residency.address as Address;
  const m = residency.metadata;
  const chain = useResidencyChain(address);
  const { me, signedIn } = useSession();
  const launched = useSearchParams().get("launched");
  const isHost = signedIn && me?.address.toLowerCase() === residency.host.toLowerCase();
  const isMember = !!chain.member?.staked;
  const beds = allBeds(m);
  const myBed = chain.member?.approved ? beds.find((b) => b.id === chain.member!.bedId) : undefined;

  return (
    <div className="space-y-8">
      {launched && <Notice tone="success">Your residency is live onchain. Share this page to collect applications.</Notice>}

      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <Cover name={m.name} className="h-48 sm:h-64" />
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div className="space-y-3">
            {chain.status && <Pill tone={statusTone(chain.status)}>{STATUS_LABEL[chain.status]}</Pill>}
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.name}</h1>
            <p className="text-muted">📍 {m.location}</p>
            <p className="text-muted">
              🗓 <LocalDate at={residency.startTime} /> → <LocalDate at={residency.endTime} /> · {durationLabel(residency.startTime, residency.endTime)}
            </p>
            {residency.city && (
              <p className="text-sm text-muted">
                🏙 Part of{" "}
                <Link href={`/cities/${residency.city.slug}`} className="font-medium text-indigo-600 hover:underline">
                  {residency.city.name}
                </Link>
              </p>
            )}
            {residency.series && (
              <p className="text-sm text-muted">
                📋 Series:{" "}
                <Link href={`/series/${residency.series.slug}`} className="font-medium text-indigo-600 hover:underline">
                  {residency.series.name}
                </Link>
              </p>
            )}
            {m.propertyUrl && (
              <a href={m.propertyUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
                View the proposed property ↗
              </a>
            )}
          </div>

          <Card className="space-y-4 self-start">
            <SeatsBar taken={chain.seatCount} min={residency.minSeats} max={residency.maxSeats} />
            <div className="flex justify-between text-sm">
              <span className="text-muted">Deadline</span>
              <span className="font-medium">
                <LocalDate at={residency.deadline} withTime />
                {chain.status === "Open" && (
                  <>
                    {" "}
                    (<Countdown to={residency.deadline} />)
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Held in contract</span>
              <span className="font-medium">{formatUsdc(chain.balance)} USDC</span>
            </div>
            <ActionPanel residency={residency} chain={chain} isHost={!!isHost} myBedLabel={myBed ? `${myBed.room} · ${myBed.label}` : undefined} />
          </Card>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Mission</h2>
            <p className="whitespace-pre-line text-foreground/90">{m.mission}</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="whitespace-pre-line text-foreground/90">{m.description}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Rooms and prices</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Room</th>
                    <th className="px-4 py-2.5 font-medium">Bed</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 text-right font-medium">Per person</th>
                  </tr>
                </thead>
                <tbody>
                  {beds.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{b.room}</td>
                      <td className="px-4 py-2.5">{b.label}</td>
                      <td className="px-4 py-2.5 capitalize">{b.type}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{Number(b.price).toLocaleString()} USDC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {(isMember || isHost) && <Treasury residency={residency} />}
        </div>

        <aside className="space-y-4">
          <h2 className="text-lg font-semibold">Organizers</h2>
          {m.organizers.map((o, i) => (
            <Card key={i} className="space-y-1 p-4">
              <p className="font-medium">{o.name}</p>
              {o.bio && <p className="text-sm text-muted">{o.bio}</p>}
              {o.link && (
                <a href={o.link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                  {o.link.replace(/^https?:\/\//, "")}
                </a>
              )}
            </Card>
          ))}
          <p className="text-xs text-muted">
            Host wallet{" "}
            <a href={addressUrl(residency.host)} target="_blank" rel="noreferrer" className="underline">
              {shortAddress(residency.host)}
            </a>{" "}
            · Residency contract{" "}
            <a href={addressUrl(residency.address)} target="_blank" rel="noreferrer" className="underline">
              {shortAddress(residency.address)}
            </a>
          </p>
        </aside>
      </div>

      <ConciergePanel scope="residency" slugOrAddress={address} name={m.name || "Residency"} />
    </div>
  );
}

function ActionPanel({
  residency,
  chain,
  isHost,
  myBedLabel,
}: {
  residency: ResidencyDto;
  chain: ReturnType<typeof useResidencyChain>;
  isHost: boolean;
  myBedLabel?: string;
}) {
  const address = residency.address as Address;
  const { signedIn } = useSession();
  const { openConnectModal } = useConnectModal();
  const tx = useTx();
  const app = useQuery({
    queryKey: ["my-application", address, signedIn],
    queryFn: () => api<{ application: Application }>(`/api/residencies/${address}/apply`),
    enabled: signedIn && !isHost,
  });

  const s = chain.status;
  const member = chain.member;

  if (isHost)
    return (
      <LinkButton href={`/r/${address}/manage`} className="w-full">
        Manage residency
      </LinkButton>
    );

  if (!signedIn)
    return s === "Open" || s === undefined ? (
      <Button className="w-full" onClick={openConnectModal}>
        Connect to apply
      </Button>
    ) : (
      <div className="space-y-2">
        <p className="text-center text-sm text-muted">Applications are closed.</p>
        <Button variant="secondary" className="w-full" onClick={openConnectModal}>
          Members: connect to see your status
        </Button>
      </div>
    );

  const refetch = () => {
    chain.refetch();
    app.refetch();
  };

  // Money back: failed/cancelled residency, or leftovers after close.
  if (chain.claimable > 0n)
    return (
      <div className="space-y-3">
        <Notice tone="info">
          {s === "Failed" ? "This residency didn't reach its minimum. Your deposit is refundable." : "The residency has closed. Your share of the unspent funds is ready."}
        </Notice>
        <Button
          className="w-full"
          loading={tx.busy}
          onClick={() => tx.send({ address, abi: residencyAbi, functionName: "claim" }).then(refetch).catch(() => {})}
        >
          Claim {formatUsdc(chain.claimable)} USDC
        </Button>
        {tx.error && <p className="text-xs text-danger">{tx.error}</p>}
      </div>
    );

  if (member?.staked)
    return (
      <Notice tone="success">
        You&apos;re in ✓ {myBedLabel && <>· {myBedLabel}</>} · paid {formatUsdc(member.price)} USDC
        {member.claimed && " · claimed"}
      </Notice>
    );

  if (s !== "Open") return <p className="text-center text-sm text-muted">Applications are closed.</p>;

  if (member?.approved) {
    const price = member.price;
    const needsApproval = chain.allowance < price;
    const short = chain.usdcBalance < price;
    return (
      <div className="space-y-3">
        <Notice tone="success">
          You&apos;re approved{myBedLabel ? ` for ${myBedLabel}` : ""}. Pay {formatUsdc(price)} USDC to hold your bed.
        </Notice>
        <p className="text-xs text-muted">
          Refunded in full if fewer than {residency.minSeats} people pay by the deadline, or if the host cancels.
        </p>
        {short && <Notice tone="error">You have {formatUsdc(chain.usdcBalance)} USDC; you need {formatUsdc(price)}.</Notice>}
        {needsApproval ? (
          <Button
            className="w-full"
            disabled={short}
            loading={tx.busy}
            onClick={() =>
              tx
                .send({ address: config.usdcAddress, abi: erc20Abi, functionName: "approve", args: [address, price] })
                .then(refetch)
                .catch(() => {})
            }
          >
            Step 1 of 2 · Allow {formatUsdc(price)} USDC
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={short}
            loading={tx.busy}
            onClick={() => tx.send({ address, abi: residencyAbi, functionName: "stake" }).then(refetch).catch(() => {})}
          >
            {chain.allowance >= price && "Step 2 of 2 · "}Pay {formatUsdc(price)} USDC
          </Button>
        )}
        {tx.label && <p className="text-center text-xs text-muted">{tx.label}</p>}
        {tx.error && <p className="text-xs text-danger">{tx.error}</p>}
      </div>
    );
  }

  const a = app.data?.application;
  if (a?.status === "pending")
    return (
      <div className="space-y-2">
        <Notice tone="info">Application sent. The host will review it.</Notice>
        <LinkButton href={`/r/${address}/apply`} variant="secondary" className="w-full">
          Edit application
        </LinkButton>
      </div>
    );
  if (a?.status === "approved")
    return <Notice tone="info">Approved: waiting for the approval transaction to confirm…</Notice>;
  if (a?.status === "denied") return <Notice tone="error">The host didn&apos;t approve this application.</Notice>;

  return (
    <LinkButton href={`/r/${address}/apply`} className="w-full">
      Apply to join
    </LinkButton>
  );
}

/** Withdrawals from chain events, with receipt files for members and the host. */
function Treasury({ residency }: { residency: ResidencyDto }) {
  const address = residency.address as Address;
  const client = usePublicClient({ chainId: config.chain.id });
  const withdrawals = useQuery({
    queryKey: ["withdrawals", address],
    queryFn: () =>
      client!.getContractEvents({
        address,
        abi: residencyAbi,
        eventName: "Withdrawn",
        fromBlock: BigInt(residency.createdBlock),
      }),
    enabled: !!client,
    refetchInterval: 30_000,
  });
  const receipts = useQuery({
    queryKey: ["receipts", address],
    queryFn: () => api<{ receipts: ReceiptRow[] }>(`/api/residencies/${address}/receipts`),
  });
  const byTx = new Map((receipts.data?.receipts ?? []).map((r) => [r.tx_hash.toLowerCase(), r]));
  const rows = [...(withdrawals.data ?? [])].reverse();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Treasury</h2>
      <p className="text-sm text-muted">Every withdrawal by the host, with its receipt. Visible to members only.</p>
      {rows.length === 0 ? (
        <Card className="text-sm text-muted">No withdrawals yet.</Card>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((w) => {
            const r = byTx.get(w.transactionHash.toLowerCase());
            return (
              <div key={w.transactionHash} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{formatUsdc(w.args.amount!)} USDC</p>
                  <p className="text-muted">{w.args.note || "No note"}</p>
                </div>
                <div className="flex gap-3">
                  {r ? (
                    <a href={`/api/residencies/${address}/receipts/${r.id}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      Receipt ↗
                    </a>
                  ) : (
                    <span className="text-muted">Receipt pending</span>
                  )}
                  <a href={txUrl(w.transactionHash)} target="_blank" rel="noreferrer" className="text-muted hover:underline">
                    Tx ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
