import { z } from "zod";
import { keccak256, stringToBytes, type Hex } from "viem";
import { MIN_DURATION_SECONDS } from "./config";

/** A price in USDC as typed by a person: up to 6 decimals, greater than zero. */
const usdcAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,6})?$/, "Enter a USDC amount like 850 or 850.50")
  .refine((v) => Number(v) > 0, "Price must be more than 0");

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://")
  .default("");

const httpsLink = z
  .string()
  .trim()
  .max(300)
  .refine((v) => /^https?:\/\//i.test(v), "Links must start with https://");

// ---------------------------------------------------------------------------------------- cities

/** A pop-up city: a place and a time window. No money, so no contract. */
export const cityInput = z
  .object({
    name: z.string().trim().min(3, "At least 3 characters").max(80),
    location: z.string().trim().min(2, "Where is it?").max(120),
    mission: z.string().trim().min(10, "Say why this city exists").max(1000),
    description: z.string().trim().min(20, "Tell people what to expect").max(5000),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    if (v.endTime <= v.startTime)
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "The city must end after it starts" });
  });

export type CityInput = z.infer<typeof cityInput>;

/** Lowercase kebab-case slug from a name. Uniqueness is handled by the caller. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "city"
  );
}

// ------------------------------------------------------------------------------------ residencies

export const bedInput = z.object({
  label: z.string().trim().min(1, "Name the bed").max(60),
  price: usdcAmount,
});

export const roomInput = z.object({
  name: z.string().trim().min(1, "Name the room").max(60),
  type: z.enum(["private", "shared"]),
  beds: z.array(bedInput).min(1, "Add at least one bed").max(20),
});

export const organizerInput = z.object({
  name: z.string().trim().min(1, "Organizer name is required").max(80),
  bio: z.string().trim().max(500).default(""),
  link: optionalUrl,
});

/** A residency is either the first instance of a new series, or the next instance of one you own. */
export const seriesChoice = z.union([
  z.object({ seriesSlug: z.string().trim().min(1).max(80) }),
  z.object({
    newSeries: z.object({
      name: z.string().trim().min(3, "Name the residency series").max(80),
      description: z.string().trim().max(2000).default(""),
    }),
  }),
]);

/** Everything the propose-a-residency form submits (the city comes from the URL). */
export const residencyInput = z
  .object({
    name: z.string().trim().min(3, "At least 3 characters").max(80),
    location: z.string().trim().min(2, "Where is it?").max(120),
    propertyUrl: optionalUrl,
    mission: z.string().trim().min(10, "Say why this residency exists").max(1000),
    description: z.string().trim().min(20, "Tell people what to expect").max(5000),
    organizers: z.array(organizerInput).min(1, "Add at least one organizer").max(10),
    rooms: z.array(roomInput).min(1, "Add at least one room").max(50),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    deadline: z.number().int().positive(),
    minSeats: z.number().int().min(1),
    maxSeats: z.number().int().min(1).max(500),
    series: seriesChoice,
  })
  .superRefine((v, ctx) => {
    const now = Math.floor(Date.now() / 1000);
    if (v.endTime - v.startTime < MIN_DURATION_SECONDS)
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "A residency runs for at least one week" });
    if (v.deadline <= now) ctx.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be in the future" });
    if (v.deadline > v.startTime)
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be on or before the start" });
    if (v.minSeats > v.maxSeats)
      ctx.addIssue({ code: "custom", path: ["minSeats"], message: "Minimum can't exceed maximum" });
    const beds = v.rooms.reduce((n, r) => n + r.beds.length, 0);
    if (v.maxSeats > beds)
      ctx.addIssue({ code: "custom", path: ["maxSeats"], message: `Only ${beds} beds listed` });
  });

export type ResidencyInput = z.infer<typeof residencyInput>;

export type Bed = { id: number; label: string; price: string };
export type Room = { name: string; type: "private" | "shared"; beds: Bed[] };
export type Organizer = { name: string; bio: string; link: string };

/**
 * The descriptive part of a residency. Its canonical JSON is hashed into the contract, so the
 * city, series and proposal it belongs to are pinned onchain along with the rooms and prices.
 */
export type ResidencyMetadata = {
  version: 2;
  cityId: string; // the city's slug
  seriesId: string; // the series' slug
  proposalId: number;
  name: string;
  location: string;
  propertyUrl: string;
  mission: string;
  description: string;
  organizers: Organizer[];
  rooms: Room[];
};

/** Build metadata with a fixed key order and sequential bed ids (1..n), so the JSON is canonical. */
export function buildMetadata(
  input: Omit<ResidencyInput, "series">,
  ids: { cityId: string; seriesId: string; proposalId: number },
): ResidencyMetadata {
  let nextBed = 1;
  return {
    version: 2,
    cityId: ids.cityId,
    seriesId: ids.seriesId,
    proposalId: ids.proposalId,
    name: input.name,
    location: input.location,
    propertyUrl: input.propertyUrl,
    mission: input.mission,
    description: input.description,
    organizers: input.organizers.map((o) => ({ name: o.name, bio: o.bio, link: o.link })),
    rooms: input.rooms.map((r) => ({
      name: r.name,
      type: r.type,
      beds: r.beds.map((b) => ({ id: nextBed++, label: b.label, price: b.price })),
    })),
  };
}

export function canonicalJson(m: ResidencyMetadata): string {
  return JSON.stringify(m);
}

export function metadataHash(json: string): Hex {
  return keccak256(stringToBytes(json));
}

export function allBeds(m: Pick<ResidencyMetadata, "rooms">): (Bed & { room: string; type: Room["type"] })[] {
  return m.rooms.flatMap((r) => r.beds.map((b) => ({ ...b, room: r.name, type: r.type })));
}

export function priceRange(m: Pick<ResidencyMetadata, "rooms">): { min: number; max: number } {
  const prices = allBeds(m).map((b) => Number(b.price));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// ----------------------------------------------------------------------------------- applications

export const applyInput = z.object({
  name: z.string().trim().min(2, "Your name").max(80),
  bio: z.string().trim().min(20, "A few sentences about you").max(2000),
  links: z.array(httpsLink).max(6).default([]),
  preferredBedId: z.number().int().positive().nullable().default(null),
});

export type ApplyInput = z.infer<typeof applyInput>;

// --------------------------------------------------------------------------------------- profiles

export const profileInput = z.object({
  name: z.string().trim().min(1, "Your name").max(80),
  bio: z.string().trim().max(1000).default(""),
  links: z.array(httpsLink).max(8).default([]),
  listed: z.boolean().default(true),
});

export type ProfileInput = z.infer<typeof profileInput>;
