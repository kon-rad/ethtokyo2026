"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { allBeds } from "@/lib/metadata";
import { api, errorMessage } from "@/lib/client/api";
import type { CityDto } from "@/lib/server/cities";
import { RequireVerified } from "@/components/require-verified";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";

type Existing = { name: string; bio: string; links: string[]; preferred_bed: number | null; status: string } | null;

export default function ApplyPage({ params }: PageProps<"/c/[address]/apply">) {
  const { address } = use(params);
  const city = useQuery({ queryKey: ["city", address], queryFn: () => api<{ city: CityDto }>(`/api/cities/${address}`) });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted">Apply to</p>
        <h1 className="text-3xl font-semibold tracking-tight">{city.data?.city.metadata.name ?? "…"}</h1>
      </div>
      <RequireVerified reason="Applicants verify with World ID first: one person, one application.">
        {city.data && <ApplyForm city={city.data.city} />}
      </RequireVerified>
    </div>
  );
}

function ApplyForm({ city }: { city: CityDto }) {
  const existing = useQuery({
    queryKey: ["my-application-edit", city.address],
    queryFn: () => api<{ application: Existing }>(`/api/cities/${city.address}/apply`),
  });
  if (existing.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;
  const a = existing.data?.application ?? null;
  if (a?.status === "approved")
    return <Notice tone="success">You&apos;re already approved. Head back to the city page to pay for your bed.</Notice>;
  return <ApplyFields city={city} existing={a} />;
}

function ApplyFields({ city, existing }: { city: CityDto; existing: Existing }) {
  const router = useRouter();
  const beds = allBeds(city.metadata);
  const [name, setName] = useState(existing?.name ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [links, setLinks] = useState((existing?.links ?? []).join("\n"));
  const [bed, setBed] = useState<string>(existing?.preferred_bed ? String(existing.preferred_bed) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/cities/${city.address}/apply`, {
        method: "POST",
        json: {
          name,
          bio,
          links: links
            .split(/\s+/)
            .map((l) => l.trim())
            .filter(Boolean),
          preferredBedId: bed ? Number(bed) : null,
        },
      });
      router.push(`/c/${city.address}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-5">
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="About you" hint="What you're working on, and what you'd bring to this city">
          <Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} required />
        </Field>
        <Field label="Links" hint="Social profiles or your website, one per line (up to 6)">
          <Textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={"https://x.com/you\nhttps://github.com/you"} />
        </Field>
        <Field label="Preferred bed" hint="The host confirms the final bed and price when approving">
          <Select value={bed} onChange={(e) => setBed(e.target.value)}>
            <option value="">No preference</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.room} · {b.label} ({b.type}) · {Number(b.price).toLocaleString()} USDC
              </option>
            ))}
          </Select>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            {existing ? "Update application" : "Send application"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
