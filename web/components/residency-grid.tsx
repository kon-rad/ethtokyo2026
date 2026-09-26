"use client";

import type { ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useInfiniteScroll } from "@/lib/client/use-infinite-scroll";
import { ResidencyCard, type ListedResidency } from "./residency-card";

type Page = { residencies: ListedResidency[]; nextCursor: number | null };

/**
 * Four-column grid of residencies with infinite scroll. With no filter it shows live residencies
 * everywhere; `city` or `series` narrows it, and `all` includes past and failed ones.
 */
export function ResidencyGrid({
  city,
  series,
  all = false,
  empty,
}: {
  city?: string;
  series?: string;
  all?: boolean;
  empty: ReactNode;
}) {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (series) params.set("series", series);
  if (all) params.set("all", "1");
  const q = useInfiniteQuery({
    queryKey: ["residencies", city, series, all],
    queryFn: ({ pageParam }) => api<Page>(`/api/residencies?${params}&cursor=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  });
  const sentinel = useInfiniteScroll(q);
  const residencies = q.data?.pages.flatMap((p) => p.residencies) ?? [];

  if (q.isLoading)
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );

  if (q.isError) return <p className="text-sm text-danger">Couldn&apos;t load residencies: {(q.error as Error).message}</p>;

  if (residencies.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {residencies.map((r) => (
          <ResidencyCard key={r.address} residency={r} />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
      {q.isFetchingNextPage && <p className="text-center text-sm text-muted">Loading more…</p>}
    </>
  );
}
