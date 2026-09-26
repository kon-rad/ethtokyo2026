import "server-only";
import type { Address } from "viem";
import { sql } from "../db";
import type { CityMetadata } from "../metadata";

export type CityRow = {
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
};

export type CityDto = {
  address: string;
  host: string;
  metadata: CityMetadata;
  metadataHash: string;
  startTime: number;
  endTime: number;
  deadline: number;
  minSeats: number;
  maxSeats: number;
  createdTx: string;
  createdBlock: string;
};

export function toDto(r: CityRow): CityDto {
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
  };
}

export async function getCity(address: Address): Promise<CityDto | null> {
  const [row] = await sql<CityRow[]>`SELECT * FROM cities WHERE address = ${address.toLowerCase()}`;
  return row ? toDto(row) : null;
}
