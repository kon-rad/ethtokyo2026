"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/client/api";
import { isAddress } from "viem";
import { useSession } from "@/components/session";
import { Button, Card, Field, Input, Notice, Pill } from "@/components/ui";
import { Avatar, PersonLink } from "@/components/person";
import { LinkButton } from "@/components/ui";
import { KnowledgeManager } from "@/components/knowledge-manager";
import type { CityDto } from "@/lib/server/cities";

export default function ManageCityPage({ params }: PageProps<"/cities/[slug]/manage">) {
  const { slug } = use(params);
  const { me, signedIn } = useSession();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["city", slug],
    queryFn: () => api<{ city: CityDto; myRole: "founder" | "core" | null }>(`/api/cities/${slug}`),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (q.isError) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  const { city, myRole } = q.data!;

  if (!signedIn || !myRole) return <Notice tone="error">Only the core team can manage this city.</Notice>;

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["city", slug] });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <LinkButton href={`/cities/${slug}`} variant="ghost">
          ← {city.name}
        </LinkButton>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage city</h1>
        <p className="mt-1 text-muted">
          {myRole === "founder" ? "You are the founder. Edit details and manage the core team." : "You are a core team member. Edit the city's details."}
        </p>
      </div>

      <EditCityForm city={city} myRole={myRole} onDone={refetch} />

      {myRole === "founder" && <CoreTeamSection city={city} onDone={refetch} />}

      <section className="space-y-4 pt-4">
        <KnowledgeManager
          scope="city"
          slugOrAddress={slug}
          sharedFiles={[
            { filename: "argo-journal", label: "Argo journal — learnings.md" },
          ]}
        />
      </section>
    </div>
  );
}

function EditCityForm({ city, myRole, onDone }: { city: CityDto; myRole: string; onDone: () => void }) {
  const [name, setName] = useState(city.name);
  const [location, setLocation] = useState(city.location);
  const [mission, setMission] = useState(city.mission);
  const [description, setDescription] = useState(city.description);
  const [start, setStart] = useState(() => toLocal(city.startTime));
  const [end, setEnd] = useState(() => toLocal(city.endTime));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/api/cities/${city.slug}`, {
        method: "PATCH",
        json: {
          name,
          location,
          mission,
          description,
          startTime: toUnix(start),
          endTime: toUnix(end),
        },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-4">
        <h2 className="font-semibold">Details</h2>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Ends">
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        <Field label="Mission">
          <textarea rows={2} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" value={mission} onChange={(e) => setMission(e.target.value)} required />
        </Field>
        <Field label="Description">
          <textarea rows={6} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
        </div>
      </Card>
    </form>
  );
}

function CoreTeamSection({ city, onDone }: { city: CityDto; onDone: () => void }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!isAddress(address)) { setError("Invalid address"); return; }
    setError(null);
    setBusy(true);
    try {
      await api(`/api/cities/${city.slug}/team`, { method: "POST", json: { address } });
      setAddress("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(addr: string) {
    setError(null);
    try {
      await api(`/api/cities/${city.slug}/team`, { method: "DELETE", json: { address: addr } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Core team</h2>
      <div className="space-y-2">
        {city.coreTeam.map((m) => (
          <div key={m.address} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <div className="flex items-center gap-2 text-sm">
              <Avatar address={m.address} name={m.name} size={28} />
              <PersonLink address={m.address} name={m.name} />
              {m.role === "founder" && <Pill tone="info">Founder</Pill>}
            </div>
            {m.role !== "founder" && (
              <button type="button" className="text-xs text-danger hover:underline" onClick={() => remove(m.address)}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… wallet address"
          className="flex-1"
        />
        <Button onClick={add} loading={busy} disabled={!address}>
          Add
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

function toUnix(local: string): number {
  return local ? Math.floor(new Date(local).getTime() / 1000) : 0;
}

function toLocal(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}