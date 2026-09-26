import { z } from "zod";
import { sql } from "@/lib/db";
import { coreRole, requireCoreTeam } from "@/lib/server/cities";
import { getProposal } from "@/lib/server/proposals";
import { requireSession, handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) fail(404, "Proposal not found");
  const p = await getProposal(id);
  if (!p) fail(404, "Proposal not found");
  return p;
}

/** The proposer and the city's core team can see a proposal, including what will be deployed. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const p = await load(ctx);
  const isProposer = p.proposer.toLowerCase() === me.address.toLowerCase();
  const role = await coreRole(p.city.id, me.address);
  if (!isProposer && !role) fail(403, "Only the proposer and the city's core team can see this proposal");
  return Response.json({ proposal: p, isProposer, myRole: role });
});

const reviewBody = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).default(""),
});

/** Core team: approve or reject a proposal that is still waiting. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const p = await load(ctx);
  await requireCoreTeam(p.city.id, me.address);

  const parsed = reviewBody.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid review");
  const { decision, note } = parsed.data;
  if (p.status !== "proposed") fail(409, `This proposal was already ${p.status}`);
  if (decision === "approve" && p.deadlinePassed)
    fail(400, "Its application deadline has passed. Ask the proposer to propose it again with new dates");

  const [updated] = await sql`
    UPDATE residency_proposals
    SET status = ${decision === "approve" ? "approved" : "rejected"}, review_note = ${note || null},
        reviewed_by = ${me.address.toLowerCase()}, reviewed_at = now()
    WHERE id = ${p.id} AND status = 'proposed'
    RETURNING id`;
  if (!updated) fail(409, "This proposal was just reviewed by someone else");
  return Response.json({ proposal: await getProposal(p.id) });
});
