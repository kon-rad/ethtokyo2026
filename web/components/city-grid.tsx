"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { CityCard, type ListedCity } from "./city-card";
import { LinkButton } from "./ui";

type Page = { cities: ListedCity[]; nextCursor: number | null };

/** Four-column grid of live cities with infinite scroll. */
export function CityGrid() {
  const q = useInfiniteQuery({
    queryKey: ["cities"],
    queryFn: ({ pageParam }) => api<Page>(`/api/cities?cursor=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  });
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  const cities = q.data?.pages.flatMap((p) => p.cities) ?? [];

  if (q.isLoading)
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );

  if (q.isError) return <p className="text-sm text-danger">Couldn&apos;t load cities: {(q.error as Error).message}</p>;

  if (cities.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
        <p className="font-medium">No live cities yet.</p>
        <p className="mt-1 text-sm text-muted">Be the first to launch one.</p>
        <LinkButton href="/launch" className="mt-5">
          Launch a city
        </LinkButton>
      </div>
    );

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cities.map((c) => (
          <CityCard key={c.address} city={c} />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
      {q.isFetchingNextPage && <p className="text-center text-sm text-muted">Loading more…</p>}
    </>
  );
}
