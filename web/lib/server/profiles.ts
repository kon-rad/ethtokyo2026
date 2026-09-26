import "server-only";
import { getAddress } from "viem";
import { sql } from "../db";
import { isStaker } from "./chain";

export type ProfileDto = {
  address: string;
  name: string;
  bio: string;
  links: string[];
  hasPhoto: boolean;
  listed: boolean;
  verifiedHuman: boolean;
};

export type ResidencyStint = {
  address: string;
  name: string;
  role: "host" | "member";
  startTime: number;
  endTime: number;
  city: { slug: string; name: string } | null;
  series: { slug: string; name: string } | null;
};

export type CityRole = { slug: string; name: string; roles: ("founder" | "core" | "host" | "resident")[] };

export type Participation = { residencies: ResidencyStint[]; cities: CityRole[] };

type ProfileRow = {
  address: string;
  name: string;
  bio: string;
  links: string[];
  has_photo: boolean;
  listed: boolean;
  verified_human: boolean;
};

const profileColumns = (s: typeof sql) => s`
  p.address, p.name, p.bio, p.links, (p.photo IS NOT NULL) AS has_photo, p.listed,
  (u.verified_at IS NOT NULL) AS verified_human`;

function toProfile(r: ProfileRow): ProfileDto {
  return {
    address: getAddress(r.address),
    name: r.name,
    bio: r.bio,
    links: r.links,
    hasPhoto: r.has_photo,
    listed: r.listed,
    verifiedHuman: r.verified_human,
  };
}

export async function getProfile(address: string): Promise<ProfileDto | null> {
  const [row] = await sql<ProfileRow[]>`
    SELECT ${profileColumns(sql)} FROM profiles p JOIN users u ON u.address = p.address
    WHERE p.address = ${address.toLowerCase()}`;
  return row ? toProfile(row) : null;
}

/** Public directory: listed profiles only, optionally filtered by name and by city. */
export async function listDirectory(opts: { q?: string; citySlug?: string; limit: number; offset: number }) {
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_]/g, "")}%` : null;
  const rows = await sql<ProfileRow[]>`
    SELECT ${profileColumns(sql)} FROM profiles p JOIN users u ON u.address = p.address
    WHERE p.listed
      ${q ? sql`AND (p.name ILIKE ${q} OR p.bio ILIKE ${q})` : sql``}
      ${opts.citySlug ? sql`AND p.address IN (${cityPeopleQuery(opts.citySlug)})` : sql``}
    ORDER BY p.updated_at DESC, p.address
    LIMIT ${opts.limit + 1} OFFSET ${opts.offset}`;
  return { profiles: rows.slice(0, opts.limit).map(toProfile), more: rows.length > opts.limit };
}

/**
 * Everyone connected to a city: its core team, its residency hosts and approved applicants.
 * Approved applicants are candidates only; the profile page confirms stakes onchain.
 */
function cityPeopleQuery(slug: string) {
  return sql`
    SELECT t.address FROM city_core_team t JOIN cities c ON c.id = t.city_id WHERE c.slug = ${slug}
    UNION
    SELECT r.host FROM residencies r JOIN cities c ON c.id = r.city_id WHERE c.slug = ${slug} AND NOT r.hidden
    UNION
    SELECT a.applicant FROM applications a
      JOIN residencies r ON r.address = a.residency JOIN cities c ON c.id = r.city_id
    WHERE c.slug = ${slug} AND a.status = 'approved' AND NOT r.hidden`;
}

type StintRow = {
  address: string;
  metadata_json: string;
  host: string;
  start_time: string;
  end_time: string;
  city_slug: string | null;
  city_name: string | null;
  series_slug: string | null;
  series_name: string | null;
};

/**
 * Residencies and cities a person has been part of. Hosting and core-team roles come from the
 * database; membership counts only if the Residency contract says they staked.
 */
export async function getParticipation(address: string): Promise<Participation> {
  const a = address.toLowerCase();
  const rows = await sql<(StintRow & { role: "host" | "member" })[]>`
    SELECT r.address, r.metadata_json, r.host, r.start_time, r.end_time,
           c.slug AS city_slug, c.name AS city_name, rs.slug AS series_slug, rs.name AS series_name,
           CASE WHEN r.host = ${a} THEN 'host' ELSE 'member' END AS role
    FROM residencies r
    LEFT JOIN cities c ON c.id = r.city_id
    LEFT JOIN residency_series rs ON rs.id = r.series_id
    WHERE NOT r.hidden
      AND (r.host = ${a}
           OR r.address IN (SELECT residency FROM applications WHERE applicant = ${a} AND status = 'approved'))
    ORDER BY r.start_time DESC`;

  const staked = await Promise.all(
    rows.map((r) =>
      r.role === "host" ? Promise.resolve(true) : isStaker(getAddress(r.address), getAddress(a)).catch(() => false),
    ),
  );
  const residencies: ResidencyStint[] = rows
    .filter((_, i) => staked[i])
    .map((r) => ({
      address: getAddress(r.address),
      name: (JSON.parse(r.metadata_json) as { name: string }).name,
      role: r.role,
      startTime: Number(r.start_time),
      endTime: Number(r.end_time),
      city: r.city_slug ? { slug: r.city_slug, name: r.city_name ?? r.city_slug } : null,
      series: r.series_slug ? { slug: r.series_slug, name: r.series_name ?? r.series_slug } : null,
    }));

  const cities = new Map<string, CityRole>();
  const addRole = (slug: string, name: string, role: CityRole["roles"][number]) => {
    const c = cities.get(slug) ?? { slug, name, roles: [] };
    if (!c.roles.includes(role)) c.roles.push(role);
    cities.set(slug, c);
  };
  const team = await sql<{ slug: string; name: string; role: "founder" | "core" }[]>`
    SELECT c.slug, c.name, t.role FROM city_core_team t JOIN cities c ON c.id = t.city_id
    WHERE t.address = ${a} ORDER BY c.start_time DESC`;
  for (const t of team) addRole(t.slug, t.name, t.role);
  for (const r of residencies) if (r.city) addRole(r.city.slug, r.city.name, r.role === "host" ? "host" : "resident");

  return { residencies, cities: [...cities.values()] };
}
