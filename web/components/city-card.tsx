"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "@/lib/client/api";
import { useInfiniteScroll } from "@/lib/client/use-infinite-scroll";
import { durationLabel } from "@/lib/format";
import { LocalDate } from "./countdown";
import { Avatar } from "./person";
import { Cover } from "./residency-card";

export type ListedCity = {
  slug: string;
  name: string;
  location: string;
  mission: string;
  startTime: number;
  endTime: number;
  residencyCount: number;
  coreTeam: { address: string; name: string | null }[];
};

export function CityCard({ city }: { city: ListedCity }) {
  return (
    <Link
      href={`/cities/${city.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <Cover name={`city:${city.name}`} className="h-28" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold leading-snug group-hover:underline">{city.name}</h3>
        <p className="text-sm text-muted">📍 {city.location}</p>
        <p className="text-sm text-muted">
          <LocalDate at={city.startTime} /> → <LocalDate at={city.endTime} /> · {durationLabel(city.startTime, city.endTime)}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-medium">
            {city.residencyCount} residenc{city.residencyCount === 1 ? "y" : "ies"}
          </span>
          <div className="flex -space-x-2">
            {city.coreTeam.slice(0, 5).map((m) => (
              <Avatar key={m.address} address={m.address} name={m.name} size={28} ring />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

type Page = { cities: ListedCity[]; nextCursor: number | null };

/** Grid of pop-up cities that haven't ended, soonest first. */
export function CityGrid({ empty }: { empty: ReactNode }) {
  const q = useInfiniteQuery({
    queryKey: ["cities"],
    queryFn: ({ pageParam }) => api<Page>(`/api/cities?cursor=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  });
  const sentinel = useInfiniteScroll(q);
  const cities = q.data?.pages.flatMap((p) => p.cities) ?? [];

  if (q.isLoading)
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  if (q.isError) return <p className="text-sm text-danger">Couldn&apos;t load cities: {(q.error as Error).message}</p>;
  if (cities.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => (
          <CityCard key={c.slug} city={c} />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
    </>
  );
}
