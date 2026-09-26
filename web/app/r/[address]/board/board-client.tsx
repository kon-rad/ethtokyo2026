"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { residencyAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { statusFromIndex, STATUS_LABEL } from "@/lib/status";
import { formatUsdc, durationLabel } from "@/lib/format";
import { api } from "@/lib/client/api";
import { useNow } from "@/components/countdown";
import type { ResidencyDto } from "@/lib/server/residencies";

type ReceiptRow = { id: number; tx_hash: string; filename: string };

type ChainState = {
  status: number;
  seatCount: number;
  totalStaked: bigint;
  balance: bigint;
  totalWithdrawn: bigint;
  cancelled: boolean;
  closed: boolean;
};

type RecentEvent =
  | { kind: "staked"; bedId: number; price: bigint; ts: number }
  | { kind: "withdrawn"; amount: bigint; note: string; ts: number }
  | { kind: "cancelled"; ts: number }
  | { kind: "closed"; balance: bigint; ts: number };

const client = createPublicClient({
  chain: config.chain,
  transport: http(config.rpcUrl),
});

function useChainState(address: Address) {
  return useQuery({
    queryKey: ["board-chain", address],
    queryFn: async () => {
      const c = { address, abi: residencyAbi } as const;
      const [status, seatCount, totalStaked, balance, totalWithdrawn, cancelled, closed] =
        await client.multicall({
          contracts: [
            { ...c, functionName: "status" },
            { ...c, functionName: "seatCount" },
            { ...c, functionName: "totalStaked" },
            { ...c, functionName: "balance" },
            { ...c, functionName: "totalWithdrawn" },
            { ...c, functionName: "cancelled" },
            { ...c, functionName: "closed" },
          ],
        });
      return {
        status: Number(status.result ?? 0),
        seatCount: Number(seatCount.result ?? 0n),
        totalStaked: (totalStaked.result as bigint) ?? 0n,
        balance: (balance.result as bigint) ?? 0n,
        totalWithdrawn: (totalWithdrawn.result as bigint) ?? 0n,
        cancelled: Boolean(cancelled.result),
        closed: Boolean(closed.result),
      } satisfies ChainState;
    },
    refetchInterval: 15_000,
  });
}

function useRecentEvents(address: Address, blockFrom: bigint) {
  return useQuery({
    queryKey: ["board-events", address, blockFrom.toString()],
    queryFn: async () => {
      const c = { address, abi: residencyAbi } as const;
      const [staked, withdrawn, cancelled, closed] = await Promise.all([
        client.getContractEvents({ ...c, eventName: "Staked", fromBlock: blockFrom }),
        client.getContractEvents({ ...c, eventName: "Withdrawn", fromBlock: blockFrom }),
        client.getContractEvents({ ...c, eventName: "Cancelled", fromBlock: blockFrom }),
        client.getContractEvents({ ...c, eventName: "Closed", fromBlock: blockFrom }),
      ]);
      const events: RecentEvent[] = [
        ...staked.map((e) => ({
          kind: "staked" as const,
          bedId: Number(e.args.bedId ?? 0),
          price: (e.args.price as bigint) ?? 0n,
          ts: Number(e.blockNumber),
        })),
        ...withdrawn.map((e) => ({
          kind: "withdrawn" as const,
          amount: (e.args.amount as bigint) ?? 0n,
          note: (e.args.note as string) ?? "",
          ts: Number(e.blockNumber),
        })),
        ...cancelled.map(() => ({ kind: "cancelled" as const, ts: 0 })),
        ...closed.map((e) => ({
          kind: "closed" as const,
          balance: (e.args.closedBalance as bigint) ?? 0n,
          ts: Number(e.blockNumber),
        })),
      ];
      events.sort((a, b) => b.ts - a.ts);
      return events.slice(0, 6);
    },
    refetchInterval: 30_000,
  });
}

function useReceipts(address: Address) {
  return useQuery({
    queryKey: ["board-receipts", address],
    queryFn: () => api<{ receipts: ReceiptRow[] }>(`/api/residencies/${address}/receipts`),
    refetchInterval: 60_000,
  });
}

export function BoardClient({ residency }: { residency: ResidencyDto }) {
  const address = residency.address as Address;
  const m = residency.metadata;
  const now = useNow(1000);
  const chain = useChainState(address);
  const events = useRecentEvents(address, BigInt(residency.createdBlock));
  const receipts = useReceipts(address);

  const s = chain.data;
  const statusLabel = s ? STATUS_LABEL[statusFromIndex(s.status) ?? "Open"] : "…";
  const isFunding = s && s.status === 0 && !s.cancelled;
  const isActive = s && s.status === 1;
  const isFailed = s && (s.status === 2 || s.cancelled);
  const isClosed = s && s.status === 3;

  const deadlineS = Math.max(0, residency.deadline - now);
  const deadlineDays = Math.floor(deadlineS / 86400);
  const deadlineHours = Math.floor((deadlineS % 86400) / 3600);
  const deadlineMins = Math.floor((deadlineS % 3600) / 60);

  const pct = s ? Math.min(100, (s.seatCount / residency.maxSeats) * 100) : 0;
  const minPct = (residency.minSeats / residency.maxSeats) * 100;

  const bg = isActive
    ? "bg-emerald-900"
    : isFailed
      ? "bg-red-900"
      : isClosed
        ? "bg-gray-800"
        : "bg-indigo-900";

  const receiptsByTx = useMemo(
    () => new Map((receipts.data?.receipts ?? []).map((r) => [r.tx_hash.toLowerCase(), r])),
    [receipts.data],
  );

  return (
    <div className={`flex h-full flex-col ${bg} text-white transition-colors duration-1000`}>
      {/* Top bar — residency name + status */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{m.name}</h1>
          <p className="truncate text-sm text-white/60">{m.location}</p>
        </div>
        <div
          className={`shrink-0 rounded-full px-4 py-1.5 text-lg font-bold ${
            isActive
              ? "bg-emerald-500 text-white"
              : isFailed
                ? "bg-red-500 text-white"
                : isClosed
                  ? "bg-gray-500 text-white"
                  : "bg-indigo-500 text-white"
          }`}
        >
          {statusLabel}
        </div>
      </div>

      {/* Middle — main metrics */}
      <div className="flex flex-1 flex-col justify-center gap-6 px-6">
        {/* Seats bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-lg">
            <span className="font-semibold">Seats filled</span>
            <span>
              {s?.seatCount ?? 0} / {residency.maxSeats}
            </span>
          </div>
          <div className="relative h-6 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                s && s.seatCount >= residency.minSeats ? "bg-emerald-400" : "bg-white/60"
              }`}
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-0 h-full w-1 bg-white"
              style={{ left: `${minPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>
              {s && s.seatCount >= residency.minSeats
                ? "Minimum reached"
                : `${residency.minSeats - (s?.seatCount ?? 0)} more to minimum`}
            </span>
            <span>min {residency.minSeats}</span>
          </div>
        </div>

        {/* Deadline countdown */}
        {isFunding && (
          <div className="text-center">
            <p className="text-sm text-white/60">Deadline</p>
            <p className="text-5xl font-bold tabular-nums tracking-tight">
              {deadlineDays > 0
                ? `${deadlineDays}d ${deadlineHours}h`
                : deadlineHours > 0
                  ? `${deadlineHours}h ${deadlineMins}m`
                  : `${deadlineMins}m ${deadlineS % 60}s`}
            </p>
          </div>
        )}

        {/* USDC metrics row */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-xs text-white/60">Held</p>
            <p className="text-2xl font-bold">{s ? formatUsdc(s.balance) : "…"} USDC</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-xs text-white/60">Staked</p>
            <p className="text-2xl font-bold">{s ? formatUsdc(s.totalStaked) : "…"} USDC</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-xs text-white/60">Withdrawn</p>
            <p className="text-2xl font-bold">{s ? formatUsdc(s.totalWithdrawn) : "…"} USDC</p>
          </div>
        </div>

        {/* Dates */}
        <p className="text-center text-sm text-white/60">
          {formatDate(residency.startTime)} &rarr; {formatDate(residency.endTime)} &middot;{" "}
          {durationLabel(residency.startTime, residency.endTime)}
        </p>
      </div>

      {/* Bottom — recent events */}
      <div className="border-t border-white/10 px-6 py-3">
        <p className="mb-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
          Recent activity
        </p>
        {events.isLoading ? (
          <p className="text-sm text-white/40">Loading events…</p>
        ) : (events.data ?? []).length === 0 ? (
          <p className="text-sm text-white/40">No activity yet</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {(events.data ?? []).slice(0, 5).map((e, i) => {
              if (e.kind === "staked")
                return (
                  <div key={i} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm">
                    <span className="text-emerald-300">+</span> Bed {e.bedId}{" "}
                    <span className="text-white/60">{formatUsdc(e.price)} USDC</span>
                  </div>
                );
              if (e.kind === "withdrawn") {
                const r = receiptsByTx.get(
                  (events.data as unknown as { txHash?: string }[])[i]?.txHash?.toLowerCase() ?? "",
                );
                return (
                  <div key={i} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm">
                    <span className="text-amber-300">$</span> {formatUsdc(e.amount)} USDC
                    {e.note && <span className="text-white/60"> &middot; {e.note}</span>}
                    {r && <span className="text-white/40"> &middot; receipt</span>}
                  </div>
                );
              }
              if (e.kind === "cancelled")
                return (
                  <div key={i} className="shrink-0 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold">
                    Cancelled
                  </div>
                );
              if (e.kind === "closed")
                return (
                  <div key={i} className="shrink-0 rounded-lg bg-gray-500/20 px-3 py-2 text-sm font-semibold">
                    Closed &middot; {formatUsdc(e.balance)} USDC left
                  </div>
                );
              return null;
            })}
          </div>
        )}
      </div>

      {/* Footer — contract address + last refresh */}
      <div className="flex items-center justify-between border-t border-white/5 px-6 py-2 text-xs text-white/30">
        <span>{address.slice(0, 6)}&hellip;{address.slice(-4)}</span>
        <span>Updates every 15s</span>
      </div>
    </div>
  );
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}