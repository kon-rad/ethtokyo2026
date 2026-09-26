"use client";


import Link from "next/link";
import type { CityMetadata } from "@/lib/metadata";
import { priceRange } from "@/lib/metadata";
import { coverGradient, durationLabel } from "@/lib/format";
import { LocalDate } from "./countdown";
import { STATUS_LABEL, type CityStatus } from "@/lib/status";
import { Pill, SeatsBar } from "./ui";

export type ListedCity = {
  address: string;
  metadata: CityMetadata;
  startTime: number;
  endTime: number;
  deadline: number;
  minSeats: number;
  maxSeats: number;
  state: { status: CityStatus; seatCount: number } | null;
};

export function statusTone(s: CityStatus | undefined) {
  if (s === "Active") return "success" as const;
  if (s === "Failed") return "danger" as const;
  if (s === "Closed") return "neutral" as const;
  return "info" as const;
}

export function CityCover({ name, className = "h-36" }: { name: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: coverGradient(name) }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
    </div>
  );
}

export function CityCard({ city }: { city: ListedCity }) {
  const m = city.metadata;
  const { min, max } = priceRange(m);
  return (
    <Link
      href={`/c/${city.address}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <CityCover name={m.name} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">{m.name}</h3>
          {city.state && <Pill tone={statusTone(city.state.status)}>{STATUS_LABEL[city.state.status]}</Pill>}
        </div>
        <p className="text-sm text-muted">📍 {m.location}</p>
        <p className="text-sm text-muted">
          <LocalDate at={city.startTime} /> · {durationLabel(city.startTime, city.endTime)}
        </p>
        <p className="text-sm font-medium">
          {min === max ? `${min.toLocaleString()} USDC` : `${min.toLocaleString()}–${max.toLocaleString()} USDC`}
          <span className="font-normal text-muted"> per person</span>
        </p>
        <div className="mt-auto">
          <SeatsBar taken={city.state?.seatCount ?? 0} min={city.minSeats} max={city.maxSeats} />
        </div>
      </div>
    </Link>
  );
}
