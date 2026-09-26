"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { factoryAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { useTx } from "@/lib/client/use-tx";
import { useSession } from "@/components/session";
import { allBeds } from "@/lib/metadata";
import { formatUsdc } from "@/lib/format";
import { LocalDate } from "@/components/countdown";
import { Button, Card, LinkButton, Notice, Pill, Textarea } from "@/components/ui";
import type { ProposalDto } from "@/lib/server/proposals";

export default function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const { id } = use(params);
  const router = useRouter();

  const q = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => api<{ proposal: ProposalDto; isProposer: boolean; myRole: "founder" | "core" | null }>(`/api/proposals/${id}`),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (q.isError) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  const { proposal, isProposer, myRole } = q.data!;
  const m = proposal.metadata;
  const beds = allBeds(m);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <LinkButton href={`/cities/${proposal.city.slug}`} variant="ghost">
          ← {proposal.city.name}
        </LinkButton>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{m.name}</h1>
        <p className="mt-1 text-muted">
          Proposed in {proposal.city.name} · {proposal.series.name} · {isProposer ? "You" : proposal.proposerName ?? "Unknown"} proposed this
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill tone={proposal.status === "approved" ? "success" : proposal.status === "rejected" ? "danger" : proposal.status === "deployed" ? "neutral" : "info"}>
          {proposal.status}
        </Pill>
        {proposal.deadlinePassed && proposal.status === "proposed" && (
          <Pill tone="warning">Deadline passed</Pill>
        )}
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Residency details</h2>
        <p>📍 {m.location}</p>
        <p>🗓 <LocalDate at={proposal.params.startTime} /> → <LocalDate at={proposal.params.endTime} /></p>
        <p>⏰ Apply by <LocalDate at={proposal.params.deadline} withTime /></p>
        <p>👥 {proposal.params.minSeats}–{proposal.params.maxSeats} people</p>
      </Card>

      {m.propertyUrl && (
        <Card className="space-y-1">
          <h2 className="font-semibold">Property</h2>
          <a href={m.propertyUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
            {m.propertyUrl} ↗
          </a>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Rooms and prices</h2>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Room</th>
                <th className="px-4 py-2.5 font-medium">Bed</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Per person</th>
              </tr>
            </thead>
            <tbody>
              {beds.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{b.room}</td>
                  <td className="px-4 py-2.5">{b.label}</td>
                  <td className="px-4 py-2.5 capitalize">{b.type}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{Number(b.price).toLocaleString()} USDC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mission</h2>
        <p className="whitespace-pre-line text-foreground/90">{m.mission}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="whitespace-pre-line text-foreground/90">{m.description}</p>
      </section>

      {m.organizers.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Organizers</h2>
          {m.organizers.map((o, i) => (
            <div key={i} className="space-y-1">
              <p className="font-medium">{o.name}</p>
              {o.bio && <p className="text-sm text-muted">{o.bio}</p>}
              {o.link && (
                <a href={o.link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                  {o.link.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          ))}
        </Card>
      )}

      {myRole && proposal.status === "proposed" && !proposal.deadlinePassed && (
        <ReviewSection proposal={proposal} onDone={() => q.refetch()} />
      )}

      {isProposer && proposal.status === "approved" && (
        <DeploySection proposal={proposal} onDone={(addr) => router.push(`/r/${addr}?launched=1`)} />
      )}

      {proposal.reviewNote && (
        <Card className="space-y-1">
          <h2 className="font-semibold">Review note</h2>
          <p className="text-sm text-muted">{proposal.reviewNote}</p>
        </Card>
      )}
    </div>
  );
}

function ReviewSection({ proposal, onDone }: { proposal: ProposalDto; onDone: () => void }) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!decision) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/api/proposals/${proposal.id}`, { method: "POST", json: { decision, note } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Review proposal</h2>
      {!decision ? (
        <div className="flex gap-3">
          <Button onClick={() => setDecision("approve")}>Approve</Button>
          <Button variant="secondary" onClick={() => setDecision("reject")}>Reject</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">Add a note for the proposer (optional)</p>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you approving or rejecting this?" />
          <div className="flex gap-3">
            <Button onClick={submit} loading={busy}>
              {decision === "approve" ? "Approve" : "Reject"}
            </Button>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

function DeploySection({ proposal, onDone }: { proposal: ProposalDto; onDone: (addr: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const tx = useTx();
  const client = usePublicClient({ chainId: config.chain.id });

  async function deploy() {
    setError(null);
    try {
      setStep("Deploying the Residency contract…");
      const receipt = await tx.send({
        address: config.factoryAddress,
        abi: factoryAbi,
        functionName: "createResidency",
        args: [
          {
            metadataHash: proposal.metadataHash as Hex,
            startTime: BigInt(proposal.params.startTime),
            endTime: BigInt(proposal.params.endTime),
            deadline: BigInt(proposal.params.deadline),
            minSeats: proposal.params.minSeats,
            maxSeats: proposal.params.maxSeats,
          } as never,
        ],
      });

      setStep("Confirming onchain…");
      const { address } = await api<{ address: string }>("/api/residencies", {
        method: "POST",
        json: { txHash: receipt.transactionHash, proposalId: proposal.id },
      });

      onDone(address);
    } catch (err) {
      setError(errorMessage(err));
      setStep(null);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Deploy this residency</h2>
      <p className="text-sm text-muted">
        The core team approved it. Deploying creates a Residency contract onchain so people can apply and pay.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex items-center gap-4">
        <Button onClick={deploy} loading={!!step}>
          Deploy now
        </Button>
        {step && <span className="text-sm text-muted">{step}</span>}
        {tx.label && <span className="text-sm text-muted">{tx.label}</span>}
      </div>
    </Card>
  );
}