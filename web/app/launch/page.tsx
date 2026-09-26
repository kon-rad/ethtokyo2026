"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { RequireVerified } from "@/components/require-verified";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";

function toUnix(local: string): number {
  return local ? Math.floor(new Date(local).getTime() / 1000) : 0;
}

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Launch a pop-up city</h1>
        <p className="mt-1 text-muted">
          A city is a place and a time window. Anyone can propose residencies inside it, and the
          core team approves which ones run. No transaction needed &mdash; cities hold no money.
        </p>
      </div>
      <RequireVerified reason="City founders verify with World ID first, so every city has a real human behind it.">
        <LaunchForm />
      </RequireVerified>
    </div>
  );
}

function LaunchForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [mission, setMission] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { slug } = await api<{ slug: string }>("/api/cities", {
        method: "POST",
        json: {
          name,
          location,
          mission,
          description,
          startTime: toUnix(start),
          endTime: toUnix(end),
        },
      });
      router.push(`/cities/${slug}?launched=1`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <Field label="City name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Edge City Goa" required />
        </Field>
        <Field label="Location" hint="City, neighbourhood or area">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Anjuna, Goa, India" required />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Dates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Ends" hint="At least one week after the start">
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Story</h2>
        <Field label="Mission statement">
          <Textarea rows={2} value={mission} onChange={(e) => setMission(e.target.value)} required />
        </Field>
        <Field label="Description" hint="What the city is about, who it's for">
          <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex items-center justify-end gap-4">
        <Button type="submit" loading={busy}>
          Launch city
        </Button>
      </div>
    </form>
  );
}