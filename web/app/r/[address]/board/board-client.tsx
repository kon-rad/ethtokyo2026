"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { residencyAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { statusFromIndex, STATUS_LABEL } from "@/lib/status";
import { formatUsdc, durationLabel } from "@/lib/format";
import { api } from "@/lib/client/api";
import { QRCodeSVG } from "qrcode.react";
import { useNow, useHydrated } from "@/components/countdown";
import { BoardCalendar } from "@/components/city-calendar";
import type { ResidencyDto } from "@/lib/server/residencies";
import type { Presence } from "@/lib/server/door";

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

/** Door check-ins from the house's seat-key door (hardware/pi4/pi4-door.py). */
function usePresence(address: Address) {
  return useQuery({
    queryKey: ["board-presence", address],
    queryFn: () => api<Presence>(`/api/residencies/${address}/door/checkins`),
    refetchInterval: 5_000,
  });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}\u2026${a.slice(-4)}`;
}

export function BoardClient({ residency }: { residency: ResidencyDto }) {
  const address = residency.address as Address;
  const m = residency.metadata;
  const now = useNow(1000);
  const hydrated = useHydrated();
  const chain = useChainState(address);
  const events = useRecentEvents(address, BigInt(residency.createdBlock));
  const receipts = useReceipts(address);
  const presence = usePresence(address);
  const inside = presence.data?.inside ?? [];
  // Door events from the last 12 hours lead the activity strip
  const doorEvents = (presence.data?.recent ?? []).filter(
    (e) => now - Date.parse(e.at) / 1000 < 12 * 3600,
  );

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

  const cityPath = residency.city ? `/cities/${residency.city.slug}` : `/r/${address}`;
  const cityUrl = hydrated ? `${window.location.origin}${cityPath}` : "";
  const cityUrlLabel = cityUrl.replace(/^https?:\/\//, "");

  // Sized for the Pi's 3.5" screen (480×320, landscape): one screen, no scrolling.
  // Chromium won't make a window narrower than ~500 px, so on the Pi the viewport is wider than
  // the panel. Cap the board at the physical screen size; on a normal monitor this does nothing.
  const fit = hydrated ? { maxWidth: window.screen.width, maxHeight: window.screen.height } : undefined;
  return (
    <div className={`flex h-full flex-col ${bg} text-white transition-colors duration-1000`} style={fit}>
      {/* Top bar: residency name + status */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-bold tracking-tight md:text-2xl">{m.name}</h1>
          <p className="truncate text-[11px] leading-tight text-white/60 md:text-sm">
            {residency.city ? `${residency.city.name} · ` : ""}
            {m.location}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold md:px-4 md:py-1.5 md:text-lg ${
            isActive ? "bg-emerald-500" : isFailed ? "bg-red-500" : isClosed ? "bg-gray-500" : "bg-indigo-500"
          }`}
        >
          {statusLabel}
        </div>
      </div>

      {/* Body: metrics on the left, QR + link on the right */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-3 px-3 py-2">
        <div className="flex min-h-0 min-w-0 flex-col justify-between gap-1.5">
          {/* Seats bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs md:text-lg">
              <span className="font-semibold">Seats filled</span>
              <span className="tabular-nums">
                {s?.seatCount ?? 0} / {residency.maxSeats}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10 md:h-5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  s && s.seatCount >= residency.minSeats ? "bg-emerald-400" : "bg-white/60"
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${minPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] leading-tight text-white/60 md:text-sm">
              <span>
                {s && s.seatCount >= residency.minSeats
                  ? "Minimum reached"
                  : `${residency.minSeats - (s?.seatCount ?? 0)} more to minimum`}
              </span>
              <span>min {residency.minSeats}</span>
            </div>
          </div>

          {/* In the house: who checked in at the door and hasn't checked out */}
          <div className="min-w-0">
            <p className="flex justify-between text-xs font-semibold md:text-lg">
              <span>In the house</span>
              <span className="tabular-nums">{inside.length}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: "2.6rem" }}>
              {inside.length === 0 ? (
                <span className="text-[10px] text-white/40 md:text-sm">
                  Nobody yet. Plug your seat key into the door to check in.
                </span>
              ) : (
                inside.map((o) => (
                  <span
                    key={o.address}
                    className="max-w-full truncate rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] leading-tight md:text-sm"
                  >
                    <span className="text-emerald-300">&#9679;</span>{" "}
                    <span className="font-semibold">{o.name ?? shortAddr(o.address)}</span>
                    {o.name && <span className="text-white/60"> {shortAddr(o.address)}</span>}
                    <span className="text-white/60"> · {o.seat ?? "no seat"}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Deadline + dates */}
          <div className="flex items-end justify-between gap-2">
            {isFunding ? (
              <div className="leading-none">
                <p className="text-[10px] text-white/60 md:text-sm">Deadline</p>
                <p className="text-xl font-bold tabular-nums tracking-tight md:text-4xl">
                  {deadlineDays > 0
                    ? `${deadlineDays}d ${deadlineHours}h`
                    : deadlineHours > 0
                      ? `${deadlineHours}h ${deadlineMins}m`
                      : `${deadlineMins}m ${deadlineS % 60}s`}
                </p>
              </div>
            ) : (
              <span />
            )}
            <p className="text-right text-[10px] leading-tight text-white/60 md:text-sm">
              {formatDate(residency.startTime)} &rarr; {formatDate(residency.endTime)}
              <br />
              {durationLabel(residency.startTime, residency.endTime)}
            </p>
          </div>

          {/* USDC metrics row */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              ["Held", s?.balance],
              ["Staked", s?.totalStaked],
              ["Withdrawn", s?.totalWithdrawn],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-lg bg-white/10 px-1 py-0.5 md:p-3">
                <p className="text-[10px] leading-tight text-white/60 md:text-xs">{label as string}</p>
                <p className="truncate text-sm leading-tight font-bold md:text-2xl">
                  {s ? formatUsdc(v as bigint) : "…"}
                  <span className="text-[10px] font-normal text-white/60 md:text-sm"> USDC</span>
                </p>
              </div>
            ))}
          </div>

          {/* City calendar (sample data) */}
          {residency.city && <BoardCalendar slug={residency.city.slug} />}
        </div>

        {/* QR to the city home page, with the link spelled out */}
        <div className="flex w-[104px] flex-col items-center justify-center gap-1 md:w-44">
          <div className="rounded-md bg-white p-1">
            {cityUrl ? (
              <QRCodeSVG value={cityUrl} size={88} marginSize={0} className="md:h-40 md:w-40" />
            ) : (
              <div className="h-[88px] w-[88px]" />
            )}
          </div>
          <p className="text-center text-[10px] leading-tight text-white/60">Scan for the city</p>
          <p className="w-full text-center text-[10px] leading-tight font-semibold break-all text-white md:text-xs">
            {cityUrlLabel}
          </p>
        </div>
      </div>

      {/* Bottom strip: recent activity + contract */}
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-1 text-[10px] md:text-sm">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden whitespace-nowrap">
          {doorEvents.slice(0, 2).map((e, i) => (
            <span key={`door-${i}`} className="shrink-0 rounded bg-white/10 px-1.5 py-0.5">
              <span className={e.direction === "in" ? "text-emerald-300" : "text-amber-300"}>
                {e.direction === "in" ? "\u2192" : "\u2190"}
              </span>{" "}
              {e.name ?? shortAddr(e.address)} {e.direction === "in" ? "checked in" : "checked out"}{" "}
              <span className="text-white/60">{formatTime(e.at)}</span>
            </span>
          ))}
          {events.isLoading ? (
            <span className="text-white/40">Loading activity…</span>
          ) : (events.data ?? []).length === 0 ? (
            doorEvents.length === 0 && <span className="text-white/40">No activity yet</span>
          ) : (
            (events.data ?? []).slice(0, 3).map((e, i) => {
              const chip = "shrink-0 rounded bg-white/10 px-1.5 py-0.5";
              if (e.kind === "staked")
                return (
                  <span key={i} className={chip}>
                    <span className="text-emerald-300">+</span> Bed {e.bedId} {formatUsdc(e.price)}
                  </span>
                );
              if (e.kind === "withdrawn") {
                const r = receiptsByTx.get(
                  (events.data as unknown as { txHash?: string }[])[i]?.txHash?.toLowerCase() ?? "",
                );
                return (
                  <span key={i} className={chip}>
                    <span className="text-amber-300">$</span> {formatUsdc(e.amount)}
                    {e.note && <span className="text-white/60"> · {e.note}</span>}
                    {r && <span className="text-white/40"> · receipt</span>}
                  </span>
                );
              }
              if (e.kind === "cancelled")
                return (
                  <span key={i} className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 font-semibold">
                    Cancelled
                  </span>
                );
              return (
                <span key={i} className="shrink-0 rounded bg-gray-500/20 px-1.5 py-0.5 font-semibold">
                  Closed · {formatUsdc(e.balance)} left
                </span>
              );
            })
          )}
        </div>
        <span className="shrink-0 text-white/30">
          {address.slice(0, 6)}&hellip;{address.slice(-4)}
        </span>
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
