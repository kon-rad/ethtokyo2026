"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useInfiniteScroll } from "@/lib/client/use-infinite-scroll";
import { CityCard, type ListedCity } from "@/components/city-card";
import { LinkButton } from "@/components/ui";

type Page = { cities: ListedCity[]; nextCursor: number | null };

export default function CitiesPage() {
  const q = useInfiniteQuery({
    queryKey: ["cities-page"],
    queryFn: ({ pageParam }) => api<Page>(`/api/cities?cursor=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  });
  const sentinel = useInfiniteScroll(q);
  const cities = q.data?.pages.flatMap((p) => p.cities) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pop-up cities</h1>
          <p className="mt-1 text-muted">
            Each city is a place and a time window, run by its core team. Propose a residency inside
            one that matches your dates.
          </p>
        </div>
        <LinkButton href="/launch">Launch a city</LinkButton>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="text-sm text-danger">Couldn&apos;t load cities: {(q.error as Error).message}</p>
      ) : cities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <p className="font-medium">No pop-up cities yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to launch one.</p>
          <LinkButton href="/launch" className="mt-5">
            Launch a city
          </LinkButton>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <CityCard key={c.slug} city={c} />
            ))}
          </div>
          <div ref={sentinel} className="h-10" />
          {q.isFetchingNextPage && <p className="text-center text-sm text-muted">Loading more…</p>}
        </>
      )}
    </div>
  );
}