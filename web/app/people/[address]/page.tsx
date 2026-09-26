"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { Avatar } from "@/components/person";
import { Card, Notice, Pill } from "@/components/ui";
import { LocalDate } from "@/components/countdown";
import { shortAddress, addressUrl } from "@/lib/format";
import type { ProfileDto, Participation } from "@/lib/server/profiles";

export default function PersonPage({ params }: PageProps<"/people/[address]">) {
  const { address } = use(params);

  const q = useQuery({
    queryKey: ["profile", address],
    queryFn: () => api<{ profile: ProfileDto; participation: Participation; isSelf: boolean }>(`/api/profiles/${address}`),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (q.isError) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  const { profile, participation, isSelf } = q.data!;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-5">
        <Avatar address={profile.address} name={profile.name} size={72} photo={profile.hasPhoto} />
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
          {profile.verifiedHuman && <Pill tone="success">Verified human</Pill>}
          {profile.bio && <p className="whitespace-pre-line text-muted">{profile.bio}</p>}
          {profile.links.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {profile.links.map((l) => (
                <a key={l} href={l} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                  {l.replace(/^https?:\/\//, "")}
                </a>
              ))}
            </div>
          )}
          {isSelf && (
            <Link href="/me" className="text-sm font-medium text-indigo-600 hover:underline">
              Edit profile →
            </Link>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cities</h2>
        {participation.cities.length === 0 ? (
          <Card className="text-sm text-muted">Not part of any city yet.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {participation.cities.map((c) => (
              <Link key={c.slug} href={`/cities/${c.slug}`} className="rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md">
                <p className="font-medium">{c.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {c.roles.map((r) => (
                    <Pill key={r} tone={r === "founder" ? "info" : r === "core" ? "info" : r === "host" ? "success" : "neutral"}>
                      {r}
                    </Pill>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Residencies</h2>
        {participation.residencies.length === 0 ? (
          <Card className="text-sm text-muted">No residencies yet.</Card>
        ) : (
          <div className="space-y-2">
            {participation.residencies.map((r) => (
              <Link key={r.address} href={`/r/${r.address}`} className="block rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-muted">
                      <LocalDate at={r.startTime} /> → <LocalDate at={r.endTime} />
                      {r.city && <> · in {r.city.name}</>}
                    </p>
                  </div>
                  <Pill tone={r.role === "host" ? "success" : "neutral"}>
                    {r.role}
                  </Pill>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Wallet:{" "}
        <a href={addressUrl(profile.address)} target="_blank" rel="noreferrer" className="underline">
          {shortAddress(profile.address)}
        </a>
      </p>
    </div>
  );
}