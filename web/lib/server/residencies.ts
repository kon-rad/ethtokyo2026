import "server-only";
import type { Address } from "viem";
import { sql } from "../db";
import type { ResidencyMetadata } from "../metadata";

export type ResidencyRow = {
  address: string;
  host: string;
  metadata_json: string;
  metadata_hash: string;
  start_time: string;
  end_time: string;
  deadline: string;
  min_seats: number;
  max_seats: number;
  created_tx: string;
  created_block: string;
  created_at: Date;
  city_id: string | null;
  series_id: string | null;
  proposal_id: string | null;
  hidden: boolean;
  hidden_note: string | null;
  // Joined from cities / residency_series (see RESIDENCY_SELECT).
  city_slug: string | null;
  city_name: string | null;
  series_slug: string | null;
  series_name: string | null;
};

export type ResidencyDto = {
  address: string;
  host: string;
  metadata: ResidencyMetadata;
  metadataHash: string;
  startTime: number;
  endTime: number;
  deadline: number;
  minSeats: number;
  maxSeats: number;
  createdTx: string;
  createdBlock: string;
  city: { id: number; slug: string; name: string } | null;
  series: { slug: string; name: string } | null;
  hidden: boolean;
  hiddenNote: string | null;
};

/** Residency columns plus the names of its city and series. Use with `sql.unsafe`-free fragments. */
export const residencySelect = (s: typeof sql) => s`
  SELECT r.*, c.slug AS city_slug, c.name AS city_name, rs.slug AS series_slug, rs.name AS series_name
  FROM residencies r
  LEFT JOIN cities c ON c.id = r.city_id
  LEFT JOIN residency_series rs ON rs.id = r.series_id`;

export function toDto(r: ResidencyRow): ResidencyDto {
  return {
    address: r.address,
    host: r.host,
    metadata: JSON.parse(r.metadata_json),
    metadataHash: r.metadata_hash,
    startTime: Number(r.start_time),
    endTime: Number(r.end_time),
    deadline: Number(r.deadline),
    minSeats: r.min_seats,
    maxSeats: r.max_seats,
    createdTx: r.created_tx,
    createdBlock: String(r.created_block),
    city: r.city_id && r.city_slug ? { id: Number(r.city_id), slug: r.city_slug, name: r.city_name ?? r.city_slug } : null,
    series: r.series_slug ? { slug: r.series_slug, name: r.series_name ?? r.series_slug } : null,
    hidden: r.hidden,
    hiddenNote: r.hidden_note,
  };
}

export async function getResidency(address: Address): Promise<ResidencyDto | null> {
  const [row] = await sql<ResidencyRow[]>`${residencySelect(sql)} WHERE r.address = ${address.toLowerCase()}`;
  return row ? toDto(row) : null;
}
