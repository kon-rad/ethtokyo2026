"use client";

import Link from "next/link";
import type { ResidencyMetadata } from "@/lib/metadata";
import { priceRange } from "@/lib/metadata";
import { coverGradient, durationLabel } from "@/lib/format";
import { LocalDate } from "./countdown";
import { STATUS_LABEL, type ResidencyStatus } from "@/lib/status";
import { Pill, SeatsBar } from "./ui";

export type ListedResidency = {
  address: string;
  metadata: ResidencyMetadata;
  startTime: number;
  endTime: number;
  deadline: number;
  minSeats: number;
  maxSeats: number;
  city: { slug: string; name: string } | null;
  series: { slug: string; name: string } | null;
  state: { status: ResidencyStatus; seatCount: number } | null;
};

export function statusTone(s: ResidencyStatus | undefined) {
  if (s === "Active") return "success" as const;
  if (s === "Failed") return "danger" as const;
  if (s === "Closed") return "neutral" as const;
  return "info" as const;
}

export function Cover({ name, className = "h-36" }: { name: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: coverGradient(name) }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
    </div>
  );
}

export function ResidencyCard({ residency }: { residency: ListedResidency }) {
  const m = residency.metadata;
  const { min, max } = priceRange(m);
  return (
    <Link
      href={`/r/${residency.address}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <Cover name={m.name} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">{m.name}</h3>
          {residency.state && <Pill tone={statusTone(residency.state.status)}>{STATUS_LABEL[residency.state.status]}</Pill>}
        </div>
        {residency.city && <p className="text-sm font-medium text-indigo-600">in {residency.city.name}</p>}
        <p className="text-sm text-muted">📍 {m.location}</p>
        <p className="text-sm text-muted">
          <LocalDate at={residency.startTime} /> · {durationLabel(residency.startTime, residency.endTime)}
        </p>
        <p className="text-sm font-medium">
          {min === max ? `${min.toLocaleString()} USDC` : `${min.toLocaleString()}–${max.toLocaleString()} USDC`}
          <span className="font-normal text-muted"> per person</span>
        </p>
        <div className="mt-auto">
          <SeatsBar taken={residency.state?.seatCount ?? 0} min={residency.minSeats} max={residency.maxSeats} />
        </div>
      </div>
    </Link>
  );
}
