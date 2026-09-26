"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatDate, formatDateTime } from "@/lib/format";

const noop = () => () => {};

/** False during SSR and hydration, true after. Use for anything time- or locale-dependent. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to }: { to: number }) {
  const hydrated = useHydrated();
  const now = useNow();
  if (!hydrated) return <span>…</span>;
  const s = Math.max(0, to - now);
  if (s === 0) return <span>passed</span>;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return <span>{d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m ${s % 60}s left`}</span>;
}

/** Dates in the viewer's own timezone, rendered after hydration. */
export function LocalDate({ at, withTime = false }: { at: number; withTime?: boolean }) {
  const hydrated = useHydrated();
  if (!hydrated) return <span>…</span>;
  return <span>{withTime ? formatDateTime(at) : formatDate(at)}</span>;
}
