"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { PersonCard, type PersonSummary } from "./person";

/** The most recently updated public profiles, for the home page. */
export function DirectoryStrip({ city, limit = 8 }: { city?: string; limit?: number }) {
  const q = useQuery({
    queryKey: ["directory-strip", city],
    queryFn: () => api<{ profiles: PersonSummary[] }>(`/api/directory${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  });
  if (q.isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />;
  const people = (q.data?.profiles ?? []).slice(0, limit);
  if (people.length === 0)
    return <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">No public profiles yet.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {people.map((p) => (
        <PersonCard key={p.address} person={p} />
      ))}
    </div>
  );
}
