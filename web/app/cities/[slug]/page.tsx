"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { durationLabel } from "@/lib/format";
import { Avatar, PersonLink } from "@/components/person";
import { ResidencyGrid } from "@/components/residency-grid";
import { LocalDate } from "@/components/countdown";
import { LinkButton, Notice, Card, Pill } from "@/components/ui";
import type { CityDto } from "@/lib/server/cities";
import type { ProposalDto } from "@/lib/server/proposals";

export default function CityPage({ params }: PageProps<"/cities/[slug]">) {
  const { slug } = use(params);
  const launched = useSearchParams().get("launched");

  const q = useQuery({
    queryKey: ["city", slug],
    queryFn: () => api<{ city: CityDto; myRole: "founder" | "core" | null }>(`/api/cities/${slug}`),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (q.isError) return <Notice tone="error">Couldn&apos;t load city: {(q.error as Error).message}</Notice>;
  const { city, myRole } = q.data!;

  return (
    <div className="space-y-8">
      {launched && <Notice tone="success">Your city is live. Add core-team members and review residency proposals.</Notice>}

      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div
          className="h-48 sm:h-64"
          style={{ background: `linear-gradient(135deg, hsl(${hash(slug) % 360} 80% 62%), hsl(${(hash(slug) + 40) % 360} 75% 52%))` }}
        />
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{city.name}</h1>
            <p className="text-muted">📍 {city.location}</p>
            <p className="text-muted">
              🗓 <LocalDate at={city.startTime} /> → <LocalDate at={city.endTime} /> · {durationLabel(city.startTime, city.endTime)}
            </p>
          </div>

          <Card className="space-y-3 self-start">
            <p className="text-sm font-medium">Core team</p>
            <div className="space-y-2">
              {city.coreTeam.map((m) => (
                <div key={m.address} className="flex items-center gap-2 text-sm">
                  <Avatar address={m.address} name={m.name} size={28} />
                  <PersonLink address={m.address} name={m.name} />
                </div>
              ))}
            </div>
            {myRole && (
              <LinkButton href={`/cities/${slug}/manage`} variant="secondary" className="w-full">
                Manage city
              </LinkButton>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Mission</h2>
            <p className="whitespace-pre-line text-foreground/90">{city.mission}</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="whitespace-pre-line text-foreground/90">{city.description}</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Residencies</h2>
                <p className="text-sm text-muted">Proposed and running in this city.</p>
              </div>
              <Link href={`/cities/${slug}/propose`} className="text-sm font-medium text-indigo-600 hover:underline">
                Propose a residency →
              </Link>
            </div>
            <ResidencyGrid
              city={slug}
              empty={
                <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
                  <p className="font-medium">No residencies in this city yet.</p>
                  <p className="mt-1 text-sm text-muted">Be the first to propose one.</p>
                  <LinkButton href={`/cities/${slug}/propose`} className="mt-5">
                    Propose a residency
                  </LinkButton>
                </div>
              }
            />
          </section>

          {myRole && <ProposalsSection citySlug={slug} />}
        </div>

        <aside className="space-y-4">
          <h2 className="text-lg font-semibold">Founder</h2>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <Avatar address={city.founder} name={null} size={28} />
              <span className="font-mono text-xs">{city.founder.slice(0, 6)}…{city.founder.slice(-4)}</span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ProposalsSection({ citySlug }: { citySlug: string }) {
  const q = useQuery({
    queryKey: ["city-proposals", citySlug],
    queryFn: () => api<{ proposals: ProposalDto[] }>(`/api/cities/${citySlug}/proposals`),
  });
  if (q.isLoading) return <div className="h-20 animate-pulse rounded-2xl bg-gray-100" />;
  const proposals = q.data?.proposals ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Proposals</h2>
      {proposals.length === 0 ? (
        <Card className="text-sm text-muted">No proposals yet.</Card>
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => (
            <Link key={p.id} href={`/proposals/${p.id}`} className="block rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{p.metadata.name}</p>
                  <p className="text-sm text-muted">
                    {p.series.name} · <LocalDate at={p.params.startTime} /> → <LocalDate at={p.params.endTime} />
                  </p>
                </div>
                <Pill tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : p.status === "deployed" ? "neutral" : "info"}>
                  {p.status}
                </Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}