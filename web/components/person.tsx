"use client";

import { useState } from "react";
import Link from "next/link";
import { coverGradient, shortAddress } from "@/lib/format";
import { cx } from "./ui";

/** Profile photo if there is one, otherwise initials on a gradient derived from the address. */
export function Avatar({
  address,
  name,
  size = 40,
  ring = false,
  photo = true,
  version,
}: {
  address: string;
  name: string | null;
  size?: number;
  ring?: boolean;
  photo?: boolean;
  version?: string | number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  const ringCls = ring ? "ring-2 ring-surface" : "";
  if (photo && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/profiles/${address}/photo${version !== undefined ? `?v=${version}` : ""}`}
        alt={name ?? shortAddress(address)}
        onError={() => setFailed(true)}
        className={cx("shrink-0 rounded-full bg-gray-100 object-cover", ringCls)}
        style={style}
      />
    );
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-white", ringCls)}
      style={{ ...style, background: coverGradient(address.toLowerCase()) }}
      aria-label={name ?? shortAddress(address)}
    >
      {initials || "·"}
    </span>
  );
}

export type PersonSummary = { address: string; name: string; bio: string; hasPhoto: boolean; verifiedHuman: boolean };

export function PersonCard({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/people/${person.address}`}
      className="group flex gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md"
    >
      <Avatar address={person.address} name={person.name} size={48} photo={person.hasPhoto} />
      <div className="min-w-0">
        <p className="truncate font-medium group-hover:underline">
          {person.name}
          {person.verifiedHuman && <span className="ml-1.5 text-xs text-emerald-600">✓</span>}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{person.bio || shortAddress(person.address)}</p>
      </div>
    </Link>
  );
}

/** A wallet shown as its profile name (linked) when public, otherwise a short address. */
export function PersonLink({ address, name }: { address: string; name: string | null }) {
  if (!name) return <span className="font-mono text-sm">{shortAddress(address)}</span>;
  return (
    <Link href={`/people/${address}`} className="font-medium hover:underline">
      {name}
    </Link>
  );
}
