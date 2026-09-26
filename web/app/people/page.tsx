"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useInfiniteScroll } from "@/lib/client/use-infinite-scroll";
import { PersonCard, type PersonSummary } from "@/components/person";
import { Input } from "@/components/ui";

type Page = { profiles: PersonSummary[]; nextCursor: number | null };

export default function PeoplePage() {
  const [query, setQuery] = useState("");

  const q = useInfiniteQuery({
    queryKey: ["directory", query],
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/directory?cursor=${pageParam}${query ? `&q=${encodeURIComponent(query)}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  });
  const sentinel = useInfiniteScroll(q);
  const people = q.data?.pages.flatMap((p) => p.profiles) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-muted">
          Everyone who has joined, with the residencies and cities they&apos;ve been part of.
        </p>
      </div>

      <div className="max-w-sm">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or bio…"
        />
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="text-sm text-danger">Couldn&apos;t load people: {(q.error as Error).message}</p>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <p className="font-medium">{query ? "No profiles match your search." : "No public profiles yet."}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {people.map((p) => (
              <PersonCard key={p.address} person={p} />
            ))}
          </div>
          <div ref={sentinel} className="h-10" />
          {q.isFetchingNextPage && <p className="text-center text-sm text-muted">Loading more…</p>}
        </>
      )}
    </div>
  );
}