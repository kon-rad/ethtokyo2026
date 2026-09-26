"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { sha256, toHex, type Address, type Hex } from "viem";
import { residencyAbi } from "@/lib/abi";
import { allBeds } from "@/lib/metadata";
import { api, errorMessage } from "@/lib/client/api";
import { useTx } from "@/lib/client/use-tx";
import { useResidencyChain } from "@/lib/client/use-residency";
import { formatUsdc, shortAddress, toUsdcUnits } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/status";
import type { ResidencyDto } from "@/lib/server/residencies";
import { statusTone } from "@/components/residency-card";
import { useSession } from "@/components/session";
import { Button, Card, Field, Input, Notice, Pill, Select } from "@/components/ui";

type AppRow = {
  id: number;
  applicant: string;
  name: string;
  bio: string;
  links: string[];
  preferred_bed: number | null;
  status: "pending" | "approved" | "denied";
  bed_id: number | null;
  price_units: string | null;
  verified_human: boolean;
};

export default function ManagePage({ params }: PageProps<"/r/[address]/manage">) {
  const { address } = use(params);
  const { me, signedIn } = useSession();
  const residency = useQuery({ queryKey: ["residency", address], queryFn: () => api<{ residency: ResidencyDto }>(`/api/residencies/${address}`) });
  const c = residency.data?.residency;

  if (!c) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (!signedIn || me?.address.toLowerCase() !== c.host.toLowerCase())
    return <Notice tone="error">Only the host wallet can manage this residency. Connect and sign in with it.</Notice>;
  return <Manage residency={c} />;
}

function Manage({ residency }: { residency: ResidencyDto }) {
  const address = residency.address as Address;
  const chain = useResidencyChain(address);
  const apps = useQuery({
    queryKey: ["applications", address],
    queryFn: () => api<{ applications: AppRow[] }>(`/api/residencies/${address}/applications`),
  });
  const refresh = () => {
    chain.refetch();
    apps.refetch();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/r/${address}`} className="text-sm text-muted hover:underline">
            ← {residency.metadata.name}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Host dashboard</h1>
        </div>
        {chain.status && <Pill tone={statusTone(chain.status)}>{STATUS_LABEL[chain.status]}</Pill>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Paid seats" value={`${chain.seatCount} / ${residency.maxSeats}`} sub={`minimum ${residency.minSeats}`} />
        <Stat label="Held in contract" value={`${formatUsdc(chain.balance)} USDC`} />
        <Stat label="Total staked" value={`${formatUsdc(chain.totalStaked)} USDC`} />
        <Stat label="Withdrawn" value={`${formatUsdc(chain.totalWithdrawn)} USDC`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Applications</h2>
        {apps.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ) : (apps.data?.applications.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No applications yet. Share the residency page.</Card>
        ) : (
          <div className="space-y-3">
            {apps.data!.applications.map((a) => (
              <ApplicationCard key={a.id} app={a} residency={residency} canDecide={chain.status === "Open"} onChange={refresh} />
            ))}
          </div>
        )}
      </section>

      {chain.status === "Active" && <Withdraw residency={residency} balance={chain.balance} onDone={refresh} />}
      <Lifecycle residency={residency} status={chain.status} onDone={refresh} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function ApplicationCard({ app, residency, canDecide, onChange }: { app: AppRow; residency: ResidencyDto; canDecide: boolean; onChange: () => void }) {
  const address = residency.address as Address;
  const beds = allBeds(residency.metadata);
  const [bedId, setBedId] = useState<string>(String(app.bed_id ?? app.preferred_bed ?? beds[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tx = useTx();
  const bed = beds.find((b) => b.id === Number(bedId));

  async function approve() {
    if (!bed) return;
    setError(null);
    try {
      const receipt = await tx.send({
        address,
        abi: residencyAbi,
        functionName: "approve",
        args: [app.applicant as Address, bed.id, toUsdcUnits(bed.price)],
      });
      await api(`/api/residencies/${address}/applications/${app.id}`, {
        method: "POST",
        json: { action: "approved", txHash: receipt.transactionHash },
      });
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function revoke() {
    setError(null);
    try {
      const receipt = await tx.send({ address, abi: residencyAbi, functionName: "revoke", args: [app.applicant as Address] });
      await api(`/api/residencies/${address}/applications/${app.id}`, {
        method: "POST",
        json: { action: "revoked", txHash: receipt.transactionHash },
      });
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function deny() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/residencies/${address}/applications/${app.id}`, { method: "POST", json: { action: "deny" } });
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const approvedBed = beds.find((b) => b.id === app.bed_id);
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {app.name} <span className="font-normal text-muted">· {shortAddress(app.applicant)}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {app.verified_human ? <Pill tone="success">✓ Verified human</Pill> : <Pill tone="warning">Not verified</Pill>}
            <Pill tone={app.status === "approved" ? "success" : app.status === "denied" ? "danger" : "neutral"}>{app.status}</Pill>
          </div>
        </div>
        {app.status === "approved" && approvedBed && (
          <p className="text-sm text-muted">
            {approvedBed.room} · {approvedBed.label} · {formatUsdc(BigInt(app.price_units ?? 0))} USDC
          </p>
        )}
      </div>
      <p className="whitespace-pre-line text-sm">{app.bio}</p>
      {app.links?.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {app.links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              {l.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      )}
      {canDecide && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          {app.status !== "approved" ? (
            <>
              <div className="min-w-64 flex-1">
                <Field label="Bed and price">
                  <Select value={bedId} onChange={(e) => setBedId(e.target.value)}>
                    {beds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.room} · {b.label} ({b.type}) · {Number(b.price).toLocaleString()} USDC
                        {app.preferred_bed === b.id ? " · preferred" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button onClick={approve} loading={tx.busy} disabled={!bed}>
                Approve
              </Button>
              {app.status !== "denied" && (
                <Button variant="secondary" onClick={deny} loading={busy}>
                  Deny
                </Button>
              )}
            </>
          ) : (
            <Button variant="danger" onClick={revoke} loading={tx.busy}>
              Revoke approval
            </Button>
          )}
          {tx.label && <span className="text-xs text-muted">{tx.label}</span>}
        </div>
      )}
      {(error || tx.error) && <p className="text-xs text-danger">{error ?? tx.error}</p>}
    </Card>
  );
}

function Withdraw({ residency, balance, onDone }: { residency: ResidencyDto; balance: bigint; onDone: () => void }) {
  const address = residency.address as Address;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const tx = useTx();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      const receiptHash = sha256(toHex(new Uint8Array(await file.arrayBuffer()))) as Hex;
      const receipt = await tx.send({
        address,
        abi: residencyAbi,
        functionName: "withdraw",
        args: [toUsdcUnits(amount), receiptHash, note],
      });
      setStatus("Uploading receipt…");
      const form = new FormData();
      form.set("file", file);
      form.set("txHash", receipt.transactionHash);
      const res = await fetch(`/api/residencies/${address}/receipts`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Receipt upload failed");
      setStatus("Withdrawn, and the receipt is visible to members.");
      setAmount("");
      setNote("");
      setFile(null);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Withdraw for expenses</h2>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            Upload the receipt or rental proof. Its fingerprint (sha256) is recorded onchain with the withdrawal, and
            members can open the file from the residency page.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (USDC)" hint={`Up to ${formatUsdc(balance)} USDC`}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
            </Field>
            <Field label="Note" hint="e.g. Villa deposit, 50%">
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} required />
            </Field>
          </div>
          <Field label="Receipt" hint="PDF, PNG, JPEG or WebP, up to 4 MB">
            <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          {status && <Notice tone="success">{status}</Notice>}
          <div className="flex items-center justify-end gap-3">
            {tx.label && <span className="text-xs text-muted">{tx.label}</span>}
            <Button type="submit" loading={tx.busy} disabled={!file}>
              Withdraw
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

function Lifecycle({ residency, status, onDone }: { residency: ResidencyDto; status: string | undefined; onDone: () => void }) {
  const address = residency.address as Address;
  const tx = useTx();
  const [confirming, setConfirming] = useState(false);

  if (status !== "Open" && status !== "Active") return null;
  const isOpen = status === "Open";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{isOpen ? "Cancel the residency" : "Close the residency"}</h2>
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          {isOpen
            ? "Cancelling before the deadline lets every guest who paid claim a full refund. This can't be undone."
            : "Closing ends withdrawals. Whatever is left in the contract is returned to guests in proportion to what they paid. This can't be undone."}
        </p>
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {isOpen ? "Cancel residency…" : "Close residency…"}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              loading={tx.busy}
              onClick={() =>
                tx
                  .send({ address, abi: residencyAbi, functionName: isOpen ? "cancel" : "close" })
                  .then(() => {
                    setConfirming(false);
                    onDone();
                  })
                  .catch(() => {})
              }
            >
              Yes, {isOpen ? "cancel" : "close"} it
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        )}
        {tx.error && <p className="text-xs text-danger">{tx.error}</p>}
      </Card>
    </section>
  );
}
