import "server-only";
import { sql } from "../db";
import { fail } from "./http";

export type CityRow = {
  id: string;
  slug: string;
  name: string;
  location: string;
  mission: string;
  description: string;
  start_time: string;
  end_time: string;
  founder: string;
  created_at: Date;
};

export type CoreMember = { address: string; role: "founder" | "core"; name: string | null };

export type CityDto = {
  id: number;
  slug: string;
  name: string;
  location: string;
  mission: string;
  description: string;
  startTime: number;
  endTime: number;
  founder: string;
  coreTeam: CoreMember[];
};

export async function getCityBySlug(slug: string): Promise<CityDto | null> {
  const [row] = await sql<CityRow[]>`SELECT * FROM cities WHERE slug = ${slug}`;
  if (!row) return null;
  return { ...toCity(row), coreTeam: await coreTeam(Number(row.id)) };
}

export async function getCityById(id: number): Promise<CityDto | null> {
  const [row] = await sql<CityRow[]>`SELECT * FROM cities WHERE id = ${id}`;
  if (!row) return null;
  return { ...toCity(row), coreTeam: await coreTeam(id) };
}

export function toCity(r: CityRow): Omit<CityDto, "coreTeam"> {
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    location: r.location,
    mission: r.mission,
    description: r.description,
    startTime: Number(r.start_time),
    endTime: Number(r.end_time),
    founder: r.founder,
  };
}

/** Founder first, then core members in the order they were added. Names from public profiles. */
export async function coreTeam(cityId: number): Promise<CoreMember[]> {
  return sql<CoreMember[]>`
    SELECT t.address, t.role, CASE WHEN p.listed THEN p.name END AS name
    FROM city_core_team t LEFT JOIN profiles p ON p.address = t.address
    WHERE t.city_id = ${cityId}
    ORDER BY (t.role = 'founder') DESC, t.added_at ASC`;
}

export async function coreRole(cityId: number, address: string): Promise<"founder" | "core" | null> {
  const [row] = await sql<{ role: "founder" | "core" }[]>`
    SELECT role FROM city_core_team WHERE city_id = ${cityId} AND address = ${address.toLowerCase()}`;
  return row?.role ?? null;
}

export async function requireCoreTeam(cityId: number, address: string): Promise<"founder" | "core"> {
  const role = await coreRole(cityId, address);
  if (!role) fail(403, "Only this city's core team can do that");
  return role;
}

/** `name` → a slug not yet used in `table`, adding -2, -3… when needed. */
export async function uniqueSlug(table: "cities" | "residency_series", base: string): Promise<string> {
  const taken = new Set(
    (
      table === "cities"
        ? await sql<{ slug: string }[]>`SELECT slug FROM cities WHERE slug = ${base} OR slug LIKE ${base + "-%"}`
        : await sql<{ slug: string }[]>`SELECT slug FROM residency_series WHERE slug = ${base} OR slug LIKE ${base + "-%"}`
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
