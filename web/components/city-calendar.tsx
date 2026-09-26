"use client";

import { useMemo } from "react";
import { sampleCityEvents, upcoming, type CityEvent } from "@/lib/city-calendar";
import { useHydrated } from "./countdown";
import { Card, Pill } from "./ui";

const KIND_TONE = {
  talk: "info",
  workshop: "warning",
  meal: "success",
  social: "neutral",
  build: "danger",
} as const;

const dayKey = (unix: number) => new Date(unix * 1000).toDateString();
const dayLabel = (unix: number) => {
  const d = new Date(unix * 1000);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const timeLabel = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function useUpcoming(slug: string) {
  const hydrated = useHydrated();
  // Dates are relative to the viewer's today, so only build them after hydration.
  return useMemo(() => (hydrated ? upcoming(sampleCityEvents(slug)) : []), [hydrated, slug]);
}

/** City home page: the next few days, grouped by day. */
export function CityCalendar({ slug }: { slug: string }) {
  const events = useUpcoming(slug);
  const days = useMemo(() => {
    const m = new Map<string, CityEvent[]>();
    for (const e of events) m.set(dayKey(e.start), [...(m.get(dayKey(e.start)) ?? []), e]);
    return [...m.values()];
  }, [events]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Calendar</h2>
          <p className="text-sm text-muted">What&apos;s on in the city this week.</p>
        </div>
        <Pill tone="warning">Sample events</Pill>
      </div>
      {days.length === 0 ? (
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {days.map((list) => (
            <Card key={dayKey(list[0].start)} className="space-y-3 p-4">
              <p className="text-sm font-semibold">{dayLabel(list[0].start)}</p>
              <ul className="space-y-2.5">
                {list.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="w-16 shrink-0 tabular-nums text-muted">{timeLabel(e.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.place} · {e.durationMin} min
                      </span>
                    </span>
                    <Pill tone={KIND_TONE[e.kind]}>{e.kind}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** Status board: the next few events, one line each, on a dark background. */
export function BoardCalendar({ slug, limit = 3 }: { slug: string; limit?: number }) {
  const events = useUpcoming(slug).slice(0, limit);
  return (
    <div className="min-h-0">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Coming up <span className="font-normal normal-case tracking-normal">· sample</span>
      </p>
      <ul className="space-y-0.5 text-[11px] leading-tight">
        {events.map((e) => (
          <li key={e.id} className="flex gap-1.5 truncate">
            <span className="w-[74px] shrink-0 tabular-nums text-white/50">
              {dayLabel(e.start) === "Today" ? "" : dayLabel(e.start).split(",")[0] + " "}
              {timeLabel(e.start)}
            </span>
            <span className="truncate">{e.title}</span>
            <span className="shrink-0 text-white/40">{e.place}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
