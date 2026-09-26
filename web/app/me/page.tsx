"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "@/components/session";
import { Avatar } from "@/components/person";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import type { ProfileDto } from "@/lib/server/profiles";
import type { ApiKeyDto } from "@/lib/server/api-keys";

export default function MePage() {
  const { me, signedIn } = useSession();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api<{ profile: ProfileDto | null }>("/api/profiles/me"),
    enabled: signedIn,
  });

  if (!signedIn) return <Notice tone="info">Connect your wallet and sign in to edit your profile.</Notice>;
  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;

  const profile = q.data?.profile ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted">This shows up in the directory and on the residencies you&apos;re part of.</p>
      </div>

      <ProfileForm profile={profile} onDone={() => { q.refetch(); router.refresh(); }} />

      <PhotoUpload />

      <AgentAccess />

      {profile && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Preview</h2>
          <div className="flex items-center gap-4">
            <Avatar address={me!.address} name={profile.name} size={48} photo={profile.hasPhoto} version={Date.now()} />
            <div>
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-muted">{profile.bio || "No bio yet"}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => router.push(`/people/${me!.address}`)}>
            View public profile
          </Button>
        </Card>
      )}
    </div>
  );
}

function ProfileForm({ profile, onDone }: { profile: ProfileDto | null; onDone: () => void }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [linksText, setLinksText] = useState((profile?.links ?? []).join("\n"));
  const [listed, setListed] = useState(profile?.listed ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/profiles/me", {
        method: "PUT",
        json: {
          name,
          bio,
          links: linksText
            .split(/\s+/)
            .map((l) => l.trim())
            .filter(Boolean),
          listed,
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
        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Bio">
          <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <Field label="Links" hint="One per line (up to 8)">
          <Textarea rows={3} value={linksText} onChange={(e) => setLinksText(e.target.value)} placeholder="https://x.com/you\nhttps://github.com/you" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} className="rounded border-line" />
          Show in the public directory
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </Card>
    </form>
  );
}

function PhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("photo", file);
      const res = await fetch("/api/profiles/me/photo", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Profile photo</h2>
      <p className="text-sm text-muted">PNG, JPEG or WebP, up to 2 MB. Square crops best.</p>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} disabled={uploading} />
      {uploading && <p className="text-sm text-muted">Uploading…</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
/** API keys for the human's agents. The key is shown once; after that only its prefix. */
function AgentAccess() {
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => api<{ keys: ApiKeyDto[] }>("/api/keys") });
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { key } = await api<{ key: string }>("/api/keys", { method: "POST", json: { name } });
      setCreated(key);
      setCopied(false);
      setName("");
      keys.refetch();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setError(null);
    try {
      await api(`/api/keys/${id}`, { method: "DELETE" });
      keys.refetch();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">Agent access</h2>
        <p className="mt-1 text-sm text-muted">
          Give your AI agent a key and it can do anything you can do here: launch cities, propose and run residencies, apply,
          and manage your profile. It can&apos;t move money. Every transaction still needs your wallet. Point the agent at{" "}
          <a href="/skill.md" className="underline">/skill.md</a> or connect it to the MCP server at <code>/api/mcp</code>.
        </p>
      </div>

      {created && (
        <Notice tone="success">
          <p className="font-medium">Copy this key now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-xs">{created}</code>
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigator.clipboard.writeText(created).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Notice>
      )}

      <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Key name" hint="Which agent uses it, e.g. Claude on my laptop">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </Field>
        </div>
        <Button type="submit" loading={busy}>
          Create key
        </Button>
      </form>

      {keys.data && keys.data.keys.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {keys.data.keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted">
                  <code>{k.prefix}…</code> · created {when(k.createdAt)} · {k.lastUsedAt ? `last used ${when(k.lastUsedAt)}` : "never used"}
                </p>
              </div>
              <Button variant="danger" type="button" onClick={() => revoke(k.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
