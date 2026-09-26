import "server-only";
import { getAddress } from "viem";
import { sql } from "../db";
import type { ResidencyMetadata } from "../metadata";

export type ProposalStatus = "proposed" | "approved" | "rejected" | "deployed";

export type ProposalDto = {
  id: number;
  status: ProposalStatus;
  proposer: string;
  proposerName: string | null;
  proposerVerified: boolean;
  city: { id: number; slug: string; name: string };
  series: { slug: string; name: string };
  metadata: ResidencyMetadata;
  metadataJson: string;
  metadataHash: string;
  params: { startTime: number; endTime: number; deadline: number; minSeats: number; maxSeats: number };
  reviewNote: string | null;
  reviewedBy: string | null;
  residencyAddress: string | null;
  deadlinePassed: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  status: ProposalStatus;
  proposer: string;
  proposer_name: string | null;
  proposer_verified: boolean;
  city_id: string;
  city_slug: string;
  city_name: string;
  series_slug: string;
  series_name: string;
  metadata_json: string;
  metadata_hash: string;
  start_time: string;
  end_time: string;
  deadline: string;
  min_seats: number;
  max_seats: number;
  review_note: string | null;
  reviewed_by: string | null;
  residency_address: string | null;
  created_at: Date;
};

function toDto(r: Row): ProposalDto {
  return {
    id: Number(r.id),
    status: r.status,
    proposer: getAddress(r.proposer),
    proposerName: r.proposer_name,
    proposerVerified: r.proposer_verified,
    city: { id: Number(r.city_id), slug: r.city_slug, name: r.city_name },
    series: { slug: r.series_slug, name: r.series_name },
    metadata: JSON.parse(r.metadata_json),
    metadataJson: r.metadata_json,
    metadataHash: r.metadata_hash,
    params: {
      startTime: Number(r.start_time),
      endTime: Number(r.end_time),
      deadline: Number(r.deadline),
      minSeats: r.min_seats,
      maxSeats: r.max_seats,
    },
    reviewNote: r.review_note,
    reviewedBy: r.reviewed_by,
    residencyAddress: r.residency_address ? getAddress(r.residency_address) : null,
    deadlinePassed: Number(r.deadline) <= Math.floor(Date.now() / 1000),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listProposals(filter: { cityId?: number; id?: number; proposer?: string }): Promise<ProposalDto[]> {
  const rows = await sql<Row[]>`
    SELECT p.*, c.slug AS city_slug, c.name AS city_name, rs.slug AS series_slug, rs.name AS series_name,
           CASE WHEN pr.listed THEN pr.name END AS proposer_name,
           (u.verified_at IS NOT NULL) AS proposer_verified,
           r.address AS residency_address
    FROM residency_proposals p
    JOIN cities c ON c.id = p.city_id
    JOIN residency_series rs ON rs.id = p.series_id
    LEFT JOIN profiles pr ON pr.address = p.proposer
    LEFT JOIN users u ON u.address = p.proposer
    LEFT JOIN residencies r ON r.proposal_id = p.id
    WHERE true
      ${filter.cityId !== undefined ? sql`AND p.city_id = ${filter.cityId}` : sql``}
      ${filter.id !== undefined ? sql`AND p.id = ${filter.id}` : sql``}
      ${filter.proposer !== undefined ? sql`AND p.proposer = ${filter.proposer.toLowerCase()}` : sql``}
    ORDER BY p.created_at DESC, p.id DESC`;
  return rows.map(toDto);
}

export async function getProposal(id: number): Promise<ProposalDto | null> {
  const [p] = await listProposals({ id });
  return p ?? null;
}
