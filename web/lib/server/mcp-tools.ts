import "server-only";
import * as me from "@/app/api/me/route";
import * as profileMe from "@/app/api/profiles/me/route";
import * as profileMePhoto from "@/app/api/profiles/me/photo/route";
import * as profile from "@/app/api/profiles/[address]/route";
import * as directory from "@/app/api/directory/route";
import * as cities from "@/app/api/cities/route";
import * as city from "@/app/api/cities/[slug]/route";
import * as cityTeam from "@/app/api/cities/[slug]/team/route";
import * as cityProposals from "@/app/api/cities/[slug]/proposals/route";
import * as proposals from "@/app/api/proposals/route";
import * as proposal from "@/app/api/proposals/[id]/route";
import * as series from "@/app/api/series/[slug]/route";
import * as seriesMine from "@/app/api/series/mine/route";
import * as residencies from "@/app/api/residencies/route";
import * as residency from "@/app/api/residencies/[address]/route";
import * as apply from "@/app/api/residencies/[address]/apply/route";
import * as applications from "@/app/api/residencies/[address]/applications/route";
import * as application from "@/app/api/residencies/[address]/applications/[id]/route";
import * as host from "@/app/api/residencies/[address]/host/route";
import * as visibility from "@/app/api/residencies/[address]/visibility/route";
import * as receipts from "@/app/api/residencies/[address]/receipts/route";
import * as tx from "@/app/api/tx/route";
import * as cityKnowledge from "@/app/api/concierge/city/[slug]/knowledge/route";
import * as residencyKnowledge from "@/app/api/concierge/residency/[address]/knowledge/route";
import * as cityConcierge from "@/app/api/concierge/city/[slug]/route";
import * as residencyConcierge from "@/app/api/concierge/residency/[address]/route";
import * as knowledgeSearch from "@/app/api/knowledge/search/route";

/**
 * The MCP tools. Each one is a thin mapping onto an HTTP route, and runs that route's handler
 * in-process, so MCP and HTTP share validation, permissions and error messages and can't drift.
 * Add a tool here whenever a route gains something agents should be able to do.
 */

type Args = Record<string, unknown>;
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
export type Call = {
  handler: Handler;
  method: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  json?: unknown;
  form?: Record<string, string | { base64: string; filename: string; mimeType: string }>;
  path: string;
};
export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: false };
  call: (a: Args) => Call;
};

// ------------------------------------------------------------------------------ schema helpers

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const int = (description: string) => ({ type: "integer", description });
const bool = (description: string) => ({ type: "boolean", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const address = str("0x Ethereum address");
const residencyAddress = str("The residency's contract address (0x…)");
const slug = str("The city's slug, e.g. edge-city-goa");
const unix = (what: string) => int(`${what}, unix seconds`);
const links = { type: "array", items: str("https:// URL"), description: "Links, each starting with https://" };
const cursor = int("Pagination cursor from the previous page's nextCursor");
const scope = { type: "string", enum: ["city", "residency"], description: "Whose knowledge base: a city or a residency" };
const scopeKey = str("City slug when scope is city, contract address when scope is residency");
const file = {
  filename: str("File name, e.g. receipt.pdf"),
  mimeType: str("MIME type, e.g. application/pdf"),
  base64: str("The file's bytes, base64-encoded"),
};

const cityFields = {
  name: str("City name, 3–80 characters"),
  location: str("Where it happens, e.g. Goa, India"),
  mission: str("Why the city exists, 10–1000 characters"),
  description: str("What to expect, 20–5000 characters"),
  startTime: unix("Start"),
  endTime: unix("End (after start)"),
};
const cityRequired = ["name", "location", "mission", "description", "startTime", "endTime"];

const residencyFields = {
  name: str("Residency name, 3–80 characters"),
  location: str("Where it is, e.g. Assagao, North Goa"),
  propertyUrl: str("Optional link to the property (http:// or https://), or empty"),
  mission: str("Why the residency exists, 10–1000 characters"),
  description: str("What guests can expect, 20–5000 characters"),
  organizers: {
    type: "array",
    minItems: 1,
    items: obj({ name: str("Organizer name"), bio: str("Short bio, optional"), link: str("Optional https:// link") }, ["name"]),
  },
  rooms: {
    type: "array",
    minItems: 1,
    description: "Rooms and their beds. Beds are numbered 1..n across all rooms, in this order.",
    items: obj(
      {
        name: str("Room name"),
        type: { type: "string", enum: ["private", "shared"] },
        beds: { type: "array", minItems: 1, items: obj({ label: str("Bed label"), price: str('Price in USDC as a decimal string, e.g. "850" or "850.50"') }, ["label", "price"]) },
      },
      ["name", "type", "beds"],
    ),
  },
  startTime: unix("Start (inside the city's dates)"),
  endTime: unix("End (at least 7 days after start, inside the city's dates)"),
  deadline: unix("Application deadline (in the future, on or before the start). If the minimum isn't reached by then, everyone is refunded"),
  minSeats: int("Minimum paid beds for the residency to go ahead"),
  maxSeats: int("Maximum beds sold (no more than the beds listed)"),
  series: {
    description: 'Either { "seriesSlug": "<a series you own>" } for its next instance, or { "newSeries": { "name", "description" } }',
    oneOf: [
      obj({ seriesSlug: str("Slug of a series you own") }, ["seriesSlug"]),
      obj({ newSeries: obj({ name: str("Series name"), description: str("Series description") }, ["name"]) }, ["newSeries"]),
    ],
  },
};
const residencyRequired = ["name", "location", "mission", "description", "organizers", "rooms", "startTime", "endTime", "deadline", "minSeats", "maxSeats", "series"];

const pick = (a: Args, keys: string[]) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const s = (v: unknown) => String(v ?? "");
const R = { readOnlyHint: true, openWorldHint: false } as const;
const W = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const D = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

function knowledge(a: Args): { handler: Record<string, Handler>; params: Record<string, string>; path: string } {
  const isCity = a.scope === "city";
  return {
    handler: (isCity ? cityKnowledge : residencyKnowledge) as Record<string, Handler>,
    params: isCity ? { slug: s(a.key) } : { address: s(a.key) },
    path: `/api/concierge/${isCity ? "city" : "residency"}/${s(a.key)}/knowledge`,
  };
}

// -------------------------------------------------------------------------------------- tools

export const tools: Tool[] = [
  // Account and profile
  {
    name: "whoami",
    title: "Who am I",
    description: "The wallet this API key acts as, and whether it's World ID verified and 18+ (needed to launch, propose, apply or edit a profile). me is null if the key is missing or revoked.",
    inputSchema: obj({}),
    annotations: R,
    call: () => ({ handler: me.GET as Handler, method: "GET", path: "/api/me" }),
  },
  {
    name: "get_my_profile",
    title: "Get my profile",
    description: "Your human's directory profile (name, bio, links, listed), or null if they haven't made one.",
    inputSchema: obj({}),
    annotations: R,
    call: () => ({ handler: profileMe.GET as Handler, method: "GET", path: "/api/profiles/me" }),
  },
  {
    name: "update_my_profile",
    title: "Create or update my profile",
    description: "Create or replace your human's public directory profile. Use only details they gave you. listed=false hides them from the directory. Verified only.",
    inputSchema: obj({ name: str("Display name"), bio: str("Up to 1000 characters"), links, listed: bool("Shown in the public directory (default true)") }, ["name"]),
    annotations: W,
    call: (a) => ({ handler: profileMe.PUT as Handler, method: "PUT", path: "/api/profiles/me", json: pick(a, ["name", "bio", "links", "listed"]) }),
  },
  {
    name: "set_my_profile_photo",
    title: "Set my profile photo",
    description: "Upload a profile photo (PNG, JPEG or WebP, under 2 MB). Save the profile first.",
    inputSchema: obj(file, ["filename", "mimeType", "base64"]),
    annotations: W,
    call: (a) => ({ handler: profileMePhoto.POST as Handler, method: "POST", path: "/api/profiles/me/photo", form: { file: { base64: s(a.base64), filename: s(a.filename), mimeType: s(a.mimeType) } } }),
  },
  {
    name: "remove_my_profile_photo",
    title: "Remove my profile photo",
    description: "Delete your human's profile photo.",
    inputSchema: obj({}),
    annotations: D,
    call: () => ({ handler: profileMePhoto.DELETE as Handler, method: "DELETE", path: "/api/profiles/me/photo" }),
  },

  // Directory
  {
    name: "search_people",
    title: "Search people",
    description: "Search the public directory by name and bio, optionally only people in one city.",
    inputSchema: obj({ q: str("Search text"), city: str("City slug to narrow to"), cursor }),
    annotations: R,
    call: (a) => ({ handler: directory.GET as Handler, method: "GET", path: "/api/directory", query: pick(a, ["q", "city", "cursor"]) }),
  },
  {
    name: "get_person",
    title: "Get a person",
    description: "A person's public profile and participation: cities founded or on the core team, residencies hosted or staked in.",
    inputSchema: obj({ address }, ["address"]),
    annotations: R,
    call: (a) => ({ handler: profile.GET as Handler, method: "GET", params: { address: s(a.address) }, path: `/api/profiles/${s(a.address)}` }),
  },

  // Cities
  {
    name: "list_cities",
    title: "List cities",
    description: "Pop-up cities that haven't ended, soonest first, with residency counts and core teams.",
    inputSchema: obj({ cursor }),
    annotations: R,
    call: (a) => ({ handler: cities.GET as Handler, method: "GET", path: "/api/cities", query: pick(a, ["cursor"]) }),
  },
  {
    name: "get_city",
    title: "Get a city",
    description: "A city's details, dates and core team, and your role in it.",
    inputSchema: obj({ slug }, ["slug"]),
    annotations: R,
    call: (a) => ({ handler: city.GET as Handler, method: "GET", params: { slug: s(a.slug) }, path: `/api/cities/${s(a.slug)}` }),
  },
  {
    name: "launch_city",
    title: "Launch a city",
    description: "Launch a pop-up city. Your human becomes its founder. No transaction, no money. Public as soon as it's created: confirm the exact details with your human first. Verified only.",
    inputSchema: obj(cityFields, cityRequired),
    annotations: W,
    call: (a) => ({ handler: cities.POST as Handler, method: "POST", path: "/api/cities", json: pick(a, cityRequired) }),
  },
  {
    name: "update_city",
    title: "Edit a city",
    description: "Replace a city's details. Send every field (read it with get_city first). Dates can't shrink past an approved residency. Core team only.",
    inputSchema: obj({ slug, ...cityFields }, ["slug", ...cityRequired]),
    annotations: W,
    call: (a) => ({ handler: city.PATCH as Handler, method: "PATCH", params: { slug: s(a.slug) }, path: `/api/cities/${s(a.slug)}`, json: pick(a, cityRequired) }),
  },
  {
    name: "add_core_team_member",
    title: "Add a core team member",
    description: "Add a wallet to a city's core team. Core team members review residency proposals and edit the city. Core team only.",
    inputSchema: obj({ slug, address }, ["slug", "address"]),
    annotations: W,
    call: (a) => ({ handler: cityTeam.POST as Handler, method: "POST", params: { slug: s(a.slug) }, path: `/api/cities/${s(a.slug)}/team`, json: { address: a.address } }),
  },
  {
    name: "remove_core_team_member",
    title: "Remove a core team member",
    description: "Remove a wallet from a city's core team. The founder can't be removed. Founder only.",
    inputSchema: obj({ slug, address }, ["slug", "address"]),
    annotations: D,
    call: (a) => ({ handler: cityTeam.DELETE as Handler, method: "DELETE", params: { slug: s(a.slug) }, path: `/api/cities/${s(a.slug)}/team`, json: { address: a.address } }),
  },

  // Proposals: applying to a city
  {
    name: "propose_residency",
    title: "Propose a residency",
    description: "Apply to a city by proposing a residency: dates, rooms, per-bed USDC prices, organizers, story. The city's core team reviews it. Confirm every field with your human first. Verified only.",
    inputSchema: obj({ citySlug: slug, ...residencyFields }, ["citySlug", ...residencyRequired]),
    annotations: W,
    call: (a) => ({
      handler: cityProposals.POST as Handler,
      method: "POST",
      params: { slug: s(a.citySlug) },
      path: `/api/cities/${s(a.citySlug)}/proposals`,
      json: pick(a, [...residencyRequired, "propertyUrl"]),
    }),
  },
  {
    name: "list_my_proposals",
    title: "List my proposals",
    description: "Every residency your human has proposed, in any city, with status (proposed, approved, rejected, deployed) and review notes.",
    inputSchema: obj({}),
    annotations: R,
    call: () => ({ handler: proposals.GET as Handler, method: "GET", path: "/api/proposals" }),
  },
  {
    name: "list_city_proposals",
    title: "List a city's proposals",
    description: "All residency proposals in a city, for its core team to review.",
    inputSchema: obj({ slug }, ["slug"]),
    annotations: R,
    call: (a) => ({ handler: cityProposals.GET as Handler, method: "GET", params: { slug: s(a.slug) }, path: `/api/cities/${s(a.slug)}/proposals` }),
  },
  {
    name: "get_proposal",
    title: "Get a proposal",
    description: "One proposal, including exactly what will be deployed. Proposer and core team only.",
    inputSchema: obj({ id: int("Proposal id") }, ["id"]),
    annotations: R,
    call: (a) => ({ handler: proposal.GET as Handler, method: "GET", params: { id: s(a.id) }, path: `/api/proposals/${s(a.id)}` }),
  },
  {
    name: "review_proposal",
    title: "Approve or reject a proposal",
    description: "Approve or reject a residency proposal, with an optional note to the proposer. Confirm with your human first. Core team only.",
    inputSchema: obj({ id: int("Proposal id"), decision: { type: "string", enum: ["approve", "reject"] }, note: str("Note to the proposer, optional") }, ["id", "decision"]),
    annotations: W,
    call: (a) => ({ handler: proposal.POST as Handler, method: "POST", params: { id: s(a.id) }, path: `/api/proposals/${s(a.id)}`, json: pick(a, ["decision", "note"]) }),
  },
  {
    name: "record_residency_deploy",
    title: "Record a residency deploy",
    description: "After your human signs the deploy_residency transaction from prepare_transaction, report its hash so the residency is listed. The server reads the mined event and checks it against the proposal.",
    inputSchema: obj({ proposalId: int("Proposal id"), txHash: str("0x transaction hash") }, ["proposalId", "txHash"]),
    annotations: W,
    call: (a) => ({ handler: residencies.POST as Handler, method: "POST", path: "/api/residencies", json: pick(a, ["proposalId", "txHash"]) }),
  },

  // Series
  {
    name: "get_series",
    title: "Get a residency series",
    description: "A recurring residency brand and all of its instances.",
    inputSchema: obj({ slug: str("Series slug") }, ["slug"]),
    annotations: R,
    call: (a) => ({ handler: series.GET as Handler, method: "GET", params: { slug: s(a.slug) }, path: `/api/series/${s(a.slug)}` }),
  },
  {
    name: "list_my_series",
    title: "List my series",
    description: "Residency series your human owns (only the owner can propose the next instance).",
    inputSchema: obj({}),
    annotations: R,
    call: () => ({ handler: seriesMine.GET as Handler, method: "GET", path: "/api/series/mine" }),
  },

  // Residencies
  {
    name: "list_residencies",
    title: "List residencies",
    description: "Residencies with live onchain status. Default: open or running ones. Filter by city or series; all=true includes past, failed and closed.",
    inputSchema: obj({ city: str("City slug"), series: str("Series slug"), all: bool("Include past, failed and closed"), cursor }),
    annotations: R,
    call: (a) => ({
      handler: residencies.GET as Handler,
      method: "GET",
      path: "/api/residencies",
      query: { ...pick(a, ["city", "series", "cursor"]), ...(a.all ? { all: "1" } : {}) },
    }),
  },
  {
    name: "get_residency",
    title: "Get a residency",
    description: "A residency's listing (rooms, beds with ids and USDC prices, organizers, dates, deadline, seats) and its onchain status.",
    inputSchema: obj({ address: residencyAddress }, ["address"]),
    annotations: R,
    call: (a) => ({ handler: residency.GET as Handler, method: "GET", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}` }),
  },
  {
    name: "apply_to_residency",
    title: "Apply to a residency",
    description: "Apply for a bed, or edit a pending or denied application. Only while the residency is Open. Use your human's own name, bio and links. Verified only.",
    inputSchema: obj(
      { address: residencyAddress, name: str("Applicant's name"), bio: str("A few sentences, 20–2000 characters"), links, preferredBedId: int("Bed id from get_residency, optional") },
      ["address", "name", "bio"],
    ),
    annotations: W,
    call: (a) => ({
      handler: apply.POST as Handler,
      method: "POST",
      params: { address: s(a.address) },
      path: `/api/residencies/${s(a.address)}/apply`,
      json: { ...pick(a, ["name", "bio", "links"]), preferredBedId: a.preferredBedId ?? null },
    }),
  },
  {
    name: "get_my_application",
    title: "Get my application",
    description: "Your human's application to a residency and its status (pending, approved with a bed and price, or denied), or null.",
    inputSchema: obj({ address: residencyAddress }, ["address"]),
    annotations: R,
    call: (a) => ({ handler: apply.GET as Handler, method: "GET", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}/apply` }),
  },
  {
    name: "list_applications",
    title: "List applications",
    description: "Every application to a residency you host.",
    inputSchema: obj({ address: residencyAddress }, ["address"]),
    annotations: R,
    call: (a) => ({ handler: applications.GET as Handler, method: "GET", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}/applications` }),
  },
  {
    name: "deny_application",
    title: "Deny an application",
    description: "Deny a pending application. No transaction. To approve, use prepare_transaction with approve_applicant. Host only.",
    inputSchema: obj({ address: residencyAddress, applicationId: int("Application id") }, ["address", "applicationId"]),
    annotations: D,
    call: (a) => ({
      handler: application.POST as Handler,
      method: "POST",
      params: { address: s(a.address), id: s(a.applicationId) },
      path: `/api/residencies/${s(a.address)}/applications/${s(a.applicationId)}`,
      json: { action: "deny" },
    }),
  },
  {
    name: "record_application_decision",
    title: "Record an approve or revoke",
    description: "After your human signs an approve_applicant or revoke_applicant transaction, report its hash. The server checks the mined event.",
    inputSchema: obj({ address: residencyAddress, applicationId: int("Application id"), action: { type: "string", enum: ["approved", "revoked"] }, txHash: str("0x transaction hash") }, ["address", "applicationId", "action", "txHash"]),
    annotations: W,
    call: (a) => ({
      handler: application.POST as Handler,
      method: "POST",
      params: { address: s(a.address), id: s(a.applicationId) },
      path: `/api/residencies/${s(a.address)}/applications/${s(a.applicationId)}`,
      json: pick(a, ["action", "txHash"]),
    }),
  },
  {
    name: "list_receipts",
    title: "List receipts",
    description: "Receipts behind the host's withdrawals. Host and paid guests only.",
    inputSchema: obj({ address: residencyAddress }, ["address"]),
    annotations: R,
    call: (a) => ({ handler: receipts.GET as Handler, method: "GET", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}/receipts` }),
  },
  {
    name: "upload_receipt",
    title: "Upload a withdrawal receipt",
    description: "After your human signs a withdraw transaction, upload the receipt file whose sha256 went onchain. PDF, PNG, JPEG or WebP, under 4 MB. Host only.",
    inputSchema: obj({ address: residencyAddress, txHash: str("0x hash of the withdraw transaction"), ...file }, ["address", "txHash", "filename", "mimeType", "base64"]),
    annotations: W,
    call: (a) => ({
      handler: receipts.POST as Handler,
      method: "POST",
      params: { address: s(a.address) },
      path: `/api/residencies/${s(a.address)}/receipts`,
      form: { txHash: s(a.txHash), file: { base64: s(a.base64), filename: s(a.filename), mimeType: s(a.mimeType) } },
    }),
  },
  {
    name: "sync_residency_host",
    title: "Sync the residency's host",
    description: "After a host transfer is accepted onchain, update the listing's host from the chain.",
    inputSchema: obj({ address: residencyAddress }, ["address"]),
    annotations: W,
    call: (a) => ({ handler: host.POST as Handler, method: "POST", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}/host` }),
  },
  {
    name: "set_residency_visibility",
    title: "Hide or show a residency",
    description: "Hide a residency from the city's listings, with a public note saying why, or show it again. City core team only.",
    inputSchema: obj({ address: residencyAddress, hidden: bool("true to hide, false to show"), note: str("Public reason, required when hiding") }, ["address", "hidden"]),
    annotations: W,
    call: (a) => ({ handler: visibility.POST as Handler, method: "POST", params: { address: s(a.address) }, path: `/api/residencies/${s(a.address)}/visibility`, json: pick(a, ["hidden", "note"]) }),
  },

  // Transactions
  {
    name: "prepare_transaction",
    title: "Prepare a transaction",
    description:
      "Get the exact transactions for an onchain action, for your human to sign. You never sign. Returns steps (to, data, function, args, summary), the page where they can do it in one click, and what to report after. Actions and their fields: deploy_residency {proposalId}; approve_applicant {residency, applicationId, bedId?}; revoke_applicant {residency, applicationId}; pay_for_bed {residency}; withdraw {residency, amount, note, receiptSha256}; cancel, close, sweep, accept_host, claim {residency}; transfer_host {residency, newHost}.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["deploy_residency", "approve_applicant", "revoke_applicant", "pay_for_bed", "withdraw", "cancel", "close", "sweep", "transfer_host", "accept_host", "claim"],
        },
        proposalId: int("deploy_residency: the approved proposal"),
        residency: residencyAddress,
        applicationId: int("approve_applicant / revoke_applicant"),
        bedId: int("approve_applicant: bed to offer; defaults to the applicant's preferred bed"),
        amount: str('withdraw: USDC, e.g. "1200"'),
        note: str("withdraw: what it pays for, up to 280 characters"),
        receiptSha256: str("withdraw: 0x sha256 of the receipt file you'll upload after"),
        newHost: str("transfer_host: the new host, or the zero address to cancel a pending transfer"),
      },
      required: ["action"],
      additionalProperties: false,
    },
    annotations: R,
    call: (a) => ({ handler: tx.POST as Handler, method: "POST", path: "/api/tx", json: a }),
  },

  // Knowledge and concierge
  {
    name: "list_knowledge",
    title: "List knowledge files",
    description: "The files in a city's or residency's knowledge base, and whether you can edit them.",
    inputSchema: obj({ scope, key: scopeKey }, ["scope", "key"]),
    annotations: R,
    call: (a) => ({ ...knowledge(a), handler: knowledge(a).handler.GET, method: "GET" }),
  },
  {
    name: "read_knowledge_file",
    title: "Read a knowledge file",
    description: "One file's full text (uploaded PDF and Word files come back as extracted text).",
    inputSchema: obj({ scope, key: scopeKey, filename: str("File name from list_knowledge") }, ["scope", "key", "filename"]),
    annotations: R,
    call: (a) => ({ ...knowledge(a), handler: knowledge(a).handler.GET, method: "GET", query: { file: a.filename } }),
  },
  {
    name: "search_knowledge",
    title: "Search knowledge",
    description: "Full-text search. residency= searches it and its city; city= searches the city and all its residencies; neither searches everything public.",
    inputSchema: obj({ q: str("Search text"), city: str("City slug"), residency: residencyAddress, limit: int("1–30, default 10") }, ["q"]),
    annotations: R,
    call: (a) => ({ handler: knowledgeSearch.GET as Handler, method: "GET", path: "/api/knowledge/search", query: pick(a, ["q", "city", "residency", "limit"]) }),
  },
  {
    name: "ask_concierge",
    title: "Ask the concierge",
    description: "Ask a city's or residency's concierge. It answers from the listing and knowledge base and cites its sources.",
    inputSchema: obj({ scope, key: scopeKey, message: str("The question") }, ["scope", "key", "message"]),
    annotations: R,
    call: (a): Call => {
      const isCity = a.scope === "city";
      return {
        handler: (isCity ? cityConcierge.POST : residencyConcierge.POST) as Handler,
        method: "POST",
        params: isCity ? { slug: s(a.key) } : { address: s(a.key) },
        path: `/api/concierge/${isCity ? "city" : "residency"}/${s(a.key)}`,
        json: { message: a.message },
      };
    },
  },
  {
    name: "write_knowledge_file",
    title: "Write a knowledge file",
    description: "Create or replace a markdown or text file in a knowledge base. City founder or residency host only.",
    inputSchema: obj({ scope, key: scopeKey, filename: str("e.g. house-rules.md"), content: str("The file's text") }, ["scope", "key", "filename", "content"]),
    annotations: W,
    call: (a) => ({ ...knowledge(a), handler: knowledge(a).handler.PUT, method: "PUT", json: pick(a, ["filename", "content"]) }),
  },
  {
    name: "upload_knowledge_file",
    title: "Upload a knowledge file",
    description: "Upload a PDF, DOCX, markdown or text file to a knowledge base. Its text is extracted for search and the concierge. City founder or residency host only.",
    inputSchema: obj({ scope, key: scopeKey, ...file }, ["scope", "key", "filename", "mimeType", "base64"]),
    annotations: W,
    call: (a) => ({
      ...knowledge(a),
      handler: knowledge(a).handler.POST,
      method: "POST",
      form: { filename: s(a.filename), file: { base64: s(a.base64), filename: s(a.filename), mimeType: s(a.mimeType) } },
    }),
  },
  {
    name: "delete_knowledge_file",
    title: "Delete a knowledge file",
    description: "Delete a file from a knowledge base. City founder or residency host only.",
    inputSchema: obj({ scope, key: scopeKey, filename: str("File name") }, ["scope", "key", "filename"]),
    annotations: D,
    call: (a) => ({ ...knowledge(a), handler: knowledge(a).handler.DELETE, method: "DELETE", json: { filename: a.filename } }),
  },
];
