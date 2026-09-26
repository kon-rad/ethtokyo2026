"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { ResidencyGrid } from "@/components/residency-grid";
import { Avatar, PersonLink } from "@/components/person";
import { Card, LinkButton, Notice } from "@/components/ui";

export default function SeriesPage({ params }: PageProps<"/series/[slug]">) {
  const { slug } = use(params);

  const q = useQuery({
    queryKey: ["series", slug],
    queryFn: () => api<{ series: { slug: string; name: string; description: string; owner: string; owner_name: string | null } }>(`/api/series/${slug}`),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (q.isError) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  const { series } = q.data!;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{series.name}</h1>
        {series.description && <p className="mt-1 text-muted">{series.description}</p>}
      </div>

      <Card className="inline-flex items-center gap-2 p-4">
        <span className="text-sm text-muted">Owned by</span>
        <Avatar address={series.owner} name={series.owner_name} size={24} />
        <PersonLink address={series.owner} name={series.owner_name} />
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Instances</h2>
        <ResidencyGrid
          series={slug}
          all
          empty={
            <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
              <p className="font-medium">No instances of this series yet.</p>
            </div>
          }
        />
      </section>
    </div>
  );
}