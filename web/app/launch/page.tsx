"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";
import { factoryAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { useTx } from "@/lib/client/use-tx";
import { RequireVerified } from "@/components/require-verified";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";

type BedDraft = { label: string; price: string };
type RoomDraft = { name: string; type: "private" | "shared"; beds: BedDraft[] };
type OrganizerDraft = { name: string; bio: string; link: string };

const emptyRoom = (i: number): RoomDraft => ({ name: `Room ${i}`, type: "private", beds: [{ label: "Bed 1", price: "" }] });

function toUnix(local: string): number {
  return local ? Math.floor(new Date(local).getTime() / 1000) : 0;
}

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Launch a pop-up city</h1>
        <p className="mt-1 text-muted">
          Publish the place, dates and beds. Launching deploys the city&apos;s own contract that holds guests&apos;
          deposits until the minimum is reached.
        </p>
      </div>
      <RequireVerified reason="Hosts verify with World ID first, so every city has a real human behind it.">
        <LaunchForm />
      </RequireVerified>
    </div>
  );
}

function LaunchForm() {
  const router = useRouter();
  const tx = useTx();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [propertyUrl, setPropertyUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [deadline, setDeadline] = useState("");
  const [minSeats, setMinSeats] = useState(2);
  const [maxSeats, setMaxSeats] = useState(10);
  const [mission, setMission] = useState("");
  const [description, setDescription] = useState("");
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoom(1)]);
  const [organizers, setOrganizers] = useState<OrganizerDraft[]>([{ name: "", bio: "", link: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const bedCount = rooms.reduce((n, r) => n + r.beds.length, 0);

  const updateRoom = (i: number, patch: Partial<RoomDraft>) =>
    setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const updateBed = (ri: number, bi: number, patch: Partial<BedDraft>) =>
    setRooms((rs) =>
      rs.map((r, j) => (j === ri ? { ...r, beds: r.beds.map((b, k) => (k === bi ? { ...b, ...patch } : b)) } : r)),
    );
  const updateOrganizer = (i: number, patch: Partial<OrganizerDraft>) =>
    setOrganizers((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setStep("Checking your city…");
      const prepared = await api<{
        metadataJson: string;
        metadataHash: Hex;
        params: { startTime: number; endTime: number; deadline: number; minSeats: number; maxSeats: number };
      }>("/api/cities/prepare", {
        method: "POST",
        json: {
          name,
          location,
          propertyUrl,
          mission,
          description,
          organizers,
          rooms,
          startTime: toUnix(start),
          endTime: toUnix(end),
          deadline: toUnix(deadline),
          minSeats,
          maxSeats,
        },
      });

      setStep("Deploying your city contract…");
      const p = prepared.params;
      const receipt = await tx.send({
        address: config.factoryAddress,
        abi: factoryAbi,
        functionName: "createCity",
        args: [
          {
            metadataHash: prepared.metadataHash,
            startTime: BigInt(p.startTime),
            endTime: BigInt(p.endTime),
            deadline: BigInt(p.deadline),
            minSeats: p.minSeats,
            maxSeats: p.maxSeats,
          },
        ],
      });

      setStep("Publishing…");
      const { address } = await api<{ address: string }>("/api/cities", {
        method: "POST",
        json: { txHash: receipt.transactionHash, metadataJson: prepared.metadataJson },
      });
      router.push(`/c/${address}?launched=1`);
    } catch (err) {
      setError(errorMessage(err));
      setStep(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Builders' House Goa" required />
        </Field>
        <Field label="Location" hint="City, neighbourhood or area">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Anjuna, Goa, India" required />
        </Field>
        <Field label="Proposed property" hint="Link to the house or rental listing (optional)">
          <Input value={propertyUrl} onChange={(e) => setPropertyUrl(e.target.value)} placeholder="https://…" type="url" />
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
        <Field
          label="Application and payment deadline"
          hint="If the minimum isn't reached by this time, everyone is refunded. Must be on or before the start."
        >
          <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">People</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum people" hint="The city only happens if this many pay">
            <Input type="number" min={1} value={minSeats} onChange={(e) => setMinSeats(Number(e.target.value))} required />
          </Field>
          <Field label="Maximum people" hint={`You've listed ${bedCount} bed${bedCount === 1 ? "" : "s"}`}>
            <Input type="number" min={1} max={500} value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))} required />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Rooms and prices</h2>
            <p className="text-sm text-muted">Price per person for the whole stay, in USDC.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setRooms((rs) => [...rs, emptyRoom(rs.length + 1)])}>
            + Room
          </Button>
        </div>
        {rooms.map((room, ri) => (
          <div key={ri} className="space-y-3 rounded-xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <Input value={room.name} onChange={(e) => updateRoom(ri, { name: e.target.value })} placeholder="Room name" required />
              <Select value={room.type} onChange={(e) => updateRoom(ri, { type: e.target.value as RoomDraft["type"] })}>
                <option value="private">Private</option>
                <option value="shared">Shared</option>
              </Select>
              <Button type="button" variant="ghost" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== ri))} disabled={rooms.length === 1}>
                Remove
              </Button>
            </div>
            {room.beds.map((bed, bi) => (
              <div key={bi} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <Input value={bed.label} onChange={(e) => updateBed(ri, bi, { label: e.target.value })} placeholder="Bed label" required />
                <Input value={bed.price} onChange={(e) => updateBed(ri, bi, { price: e.target.value })} placeholder="Price (USDC)" inputMode="decimal" required />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => updateRoom(ri, { beds: room.beds.filter((_, k) => k !== bi) })}
                  disabled={room.beds.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-indigo-600 hover:underline"
              onClick={() => updateRoom(ri, { beds: [...room.beds, { label: `Bed ${room.beds.length + 1}`, price: room.beds.at(-1)?.price ?? "" }] })}
            >
              + Add bed
            </button>
          </div>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Organizers</h2>
          <Button type="button" variant="secondary" onClick={() => setOrganizers((os) => [...os, { name: "", bio: "", link: "" }])}>
            + Organizer
          </Button>
        </div>
        {organizers.map((o, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={o.name} onChange={(e) => updateOrganizer(i, { name: e.target.value })} placeholder="Name" required />
              <Input value={o.link} onChange={(e) => updateOrganizer(i, { link: e.target.value })} placeholder="https://x.com/…" type="url" />
            </div>
            <Textarea rows={2} value={o.bio} onChange={(e) => updateOrganizer(i, { bio: e.target.value })} placeholder="Short bio" />
            {organizers.length > 1 && (
              <button type="button" className="text-sm text-danger hover:underline" onClick={() => setOrganizers((os) => os.filter((_, j) => j !== i))}>
                Remove organizer
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-muted">The wallet that launches the city is the host: it approves guests and withdraws funds.</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Story</h2>
        <Field label="Mission statement">
          <Textarea rows={2} value={mission} onChange={(e) => setMission(e.target.value)} required />
        </Field>
        <Field label="Description" hint="What a day looks like, who it's for, what's included">
          <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex items-center justify-end gap-4">
        {(tx.label || step) && <span className="text-sm text-muted">{tx.label ?? step}</span>}
        <Button type="submit" loading={!!step}>
          Launch city
        </Button>
      </div>
    </form>
  );
}
