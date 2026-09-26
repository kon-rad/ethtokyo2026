import "server-only";
import { z } from "zod";
import { encodeFunctionData, getAbiItem, getAddress, toFunctionSignature, isAddress, zeroAddress, type Abi, type AbiFunction, type Address, type Hex } from "viem";
import { sql } from "../db";
import { config } from "../config";
import { erc20Abi, factoryAbi, residencyAbi } from "../abi";
import { formatUsdc, toUsdcUnits } from "../format";
import { allBeds } from "../metadata";
import { publicClient, readResidencyState } from "./chain";
import { getProposal } from "./proposals";
import { getResidency, type ResidencyDto } from "./residencies";
import { fail } from "./http";
import type { Me } from "./session";

/**
 * Prepares the transactions behind every onchain button in the UI, so an agent can hand them to
 * its human to sign. Each action checks the same rules the contract and the UI do and fails early
 * with the message the UI would show. Nothing here signs or sends anything.
 */

const address = z.string().refine((v) => isAddress(v), "Invalid address");
const residency = z.object({ residency: address });
const usdc = z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "Enter a USDC amount like 850 or 850.50");

export const txInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deploy_residency"), proposalId: z.coerce.number().int().positive() }),
  residency.extend({ action: z.literal("approve_applicant"), applicationId: z.coerce.number().int().positive(), bedId: z.coerce.number().int().positive().optional() }),
  residency.extend({ action: z.literal("revoke_applicant"), applicationId: z.coerce.number().int().positive() }),
  residency.extend({ action: z.literal("pay_for_bed") }),
  residency.extend({
    action: z.literal("withdraw"),
    amount: usdc,
    note: z.string().trim().min(1, "Say what the money is for").max(280),
    receiptSha256: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "receiptSha256 is the sha256 of the receipt file, 0x + 64 hex"),
  }),
  residency.extend({ action: z.literal("cancel") }),
  residency.extend({ action: z.literal("close") }),
  residency.extend({ action: z.literal("sweep") }),
  residency.extend({ action: z.literal("transfer_host"), newHost: address }),
  residency.extend({ action: z.literal("accept_host") }),
  residency.extend({ action: z.literal("claim") }),
]);

export type TxInput = z.infer<typeof txInput>;

export type TxStep = { to: Address; data: Hex; value: "0"; function: string; args: string[]; summary: string };
export type PreparedTx = { action: TxInput["action"]; chainId: number; page: string; steps: TxStep[]; after: string };

function step(to: Address, abi: Abi, functionName: string, args: readonly unknown[], summary: string): TxStep {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const show = (v: unknown): string =>
    typeof v === "bigint" ? v.toString() : typeof v === "object" && v ? JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)) : String(v);
  return { to, data, value: "0", function: toFunctionSignature(getAbiItem({ abi, name: functionName } as never) as AbiFunction), args: args.map(show), summary };
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function loadResidency(raw: string): Promise<ResidencyDto & { at: Address }> {
  const at = getAddress(raw);
  const r = await getResidency(at);
  if (!r) fail(404, "Residency not found");
  return { ...r, at };
}

function requireHost(r: ResidencyDto, me: Me) {
  if (!same(r.host, me.address)) fail(403, "Only the host can do this");
}

export async function prepareTx(input: TxInput, me: Me, origin: string): Promise<PreparedTx> {
  const base = { action: input.action, chainId: config.chain.id };

  if (input.action === "deploy_residency") {
    const p = await getProposal(input.proposalId);
    if (!p) fail(404, "Proposal not found");
    if (!same(p.proposer, me.address)) fail(403, "Only the proposer deploys this residency");
    if (p.status === "deployed") fail(409, "This proposal is already deployed");
    if (p.status !== "approved") fail(400, "The city's core team hasn't approved this proposal");
    if (p.deadlinePassed) fail(400, "Its application deadline has passed. Propose it again with new dates");
    const params = {
      metadataHash: p.metadataHash as Hex,
      startTime: BigInt(p.params.startTime),
      endTime: BigInt(p.params.endTime),
      deadline: BigInt(p.params.deadline),
      minSeats: p.params.minSeats,
      maxSeats: p.params.maxSeats,
    };
    return {
      ...base,
      page: `${origin}/proposals/${p.id}`,
      steps: [step(config.factoryAddress, factoryAbi, "createResidency", [params], `Deploy "${p.metadata.name}" as its own Residency contract`)],
      after: `POST /api/residencies with { "txHash": "<hash>", "proposalId": ${p.id} } (the page does this for you)`,
    };
  }

  const r = await loadResidency(input.residency);
  const page = `${origin}/r/${r.at}`;
  const manage = `${page}/manage`;
  const state = await readResidencyState(r.at);
  const c = { address: r.at, abi: residencyAbi } as const;

  switch (input.action) {
    case "approve_applicant":
    case "revoke_applicant": {
      requireHost(r, me);
      if (state.status !== "Open") fail(400, "Applications can only change while the residency is Open");
      const [app] = await sql<{ id: string; applicant: string; status: string; preferred_bed: number | null }[]>`
        SELECT id, applicant, status, preferred_bed FROM applications
        WHERE id = ${input.applicationId} AND residency = ${r.at.toLowerCase()}`;
      if (!app) fail(404, "Application not found");
      const applicant = getAddress(app.applicant);
      const member = await publicClient.readContract({ ...c, functionName: "getMember", args: [applicant] });
      if (member.staked) fail(400, "This guest has already paid; their bed can't change");
      const after = (decision: string) =>
        `POST /api/residencies/${r.at}/applications/${app.id} with { "action": "${decision}", "txHash": "<hash>" } (the page does this for you)`;

      if (input.action === "revoke_applicant") {
        if (!member.approved) fail(400, "This applicant isn't approved onchain");
        return { ...base, page: manage, steps: [step(r.at, residencyAbi, "revoke", [applicant], `Withdraw the bed offer to ${applicant}`)], after: after("revoked") };
      }
      const bedId = input.bedId ?? app.preferred_bed;
      if (!bedId) fail(400, "Pick a bed: the applicant didn't ask for one");
      const bed = allBeds(r.metadata).find((b) => b.id === bedId);
      if (!bed) fail(400, "Unknown bed");
      return {
        ...base,
        page: manage,
        steps: [step(r.at, residencyAbi, "approve", [applicant, bed.id, toUsdcUnits(bed.price)], `Offer bed ${bed.id} (${bed.room}, ${bed.label}) to ${applicant} for ${bed.price} USDC`)],
        after: after("approved"),
      };
    }

    case "pay_for_bed": {
      if (state.status !== "Open") fail(400, "This residency is no longer taking payments");
      const member = await publicClient.readContract({ ...c, functionName: "getMember", args: [me.address] });
      if (!member.approved) fail(400, "The host hasn't approved you for a bed yet");
      if (member.staked) fail(400, "You've already paid for your bed");
      if (state.seatCount >= r.maxSeats) fail(400, "This residency is full");
      const price = member.price;
      const [allowance, held] = await Promise.all([
        publicClient.readContract({ address: config.usdcAddress, abi: erc20Abi, functionName: "allowance", args: [me.address, r.at] }),
        publicClient.readContract({ address: config.usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [me.address] }),
      ]);
      if (held < price) fail(400, `You need ${formatUsdc(price)} USDC and hold ${formatUsdc(held)}`);
      const steps: TxStep[] = [];
      if (allowance < price)
        steps.push(step(config.usdcAddress, erc20Abi as Abi, "approve", [r.at, price], `Let the residency take ${formatUsdc(price)} USDC`));
      steps.push(step(r.at, residencyAbi, "stake", [price], `Pay ${formatUsdc(price)} USDC for bed ${member.bedId}. Refunded if the residency doesn't reach its minimum`));
      return { ...base, page, steps, after: "Nothing to report: the chain is the record. Check GET /api/residencies/{address} afterwards." };
    }

    case "withdraw": {
      requireHost(r, me);
      if (state.status !== "Active") fail(400, "Withdrawals open once the residency is Active");
      const amount = toUsdcUnits(input.amount);
      if (amount <= 0n || amount > BigInt(state.balance)) fail(400, `You can withdraw up to ${formatUsdc(state.balance)} USDC`);
      return {
        ...base,
        page: manage,
        steps: [step(r.at, residencyAbi, "withdraw", [amount, input.receiptSha256 as Hex, input.note], `Withdraw ${input.amount} USDC to the host for "${input.note}"`)],
        after: `POST /api/residencies/${r.at}/receipts as multipart: file=<the receipt whose sha256 you used>, txHash=<hash>. Members see it.`,
      };
    }

    case "cancel":
      requireHost(r, me);
      if (state.status !== "Open") fail(400, "Only an Open residency can be cancelled");
      return { ...base, page: manage, steps: [step(r.at, residencyAbi, "cancel", [], "Cancel the residency. Every guest can claim a full refund. Can't be undone")], after: "Nothing to report." };

    case "close": {
      if (state.status !== "Active") fail(400, "Only an Active residency can be closed");
      if (!same(r.host, me.address) && Date.now() / 1000 < r.endTime) fail(403, "Only the host can close before the end date");
      return { ...base, page: manage, steps: [step(r.at, residencyAbi, "close", [], "Close the residency. Leftover USDC becomes claimable pro-rata by guests. Can't be undone")], after: "Nothing to report." };
    }

    case "sweep": {
      requireHost(r, me);
      if (state.status !== "Closed") fail(400, "Only a Closed residency can be swept");
      const [closedAt, delay] = await Promise.all([
        publicClient.readContract({ ...c, functionName: "closedAt" }),
        publicClient.readContract({ ...c, functionName: "SWEEP_DELAY" }),
      ]);
      const at = Number(closedAt + delay);
      if (Date.now() / 1000 < at) fail(400, `Sweep opens ${new Date(at * 1000).toISOString().slice(0, 10)}`);
      return { ...base, page: manage, steps: [step(r.at, residencyAbi, "sweep", [], "Collect unclaimed leftovers to the host")], after: "Nothing to report." };
    }

    case "transfer_host": {
      requireHost(r, me);
      const to = getAddress(input.newHost);
      const summary = to === zeroAddress ? "Cancel the pending host transfer" : `Offer the host role to ${to}. They must accept it`;
      return { ...base, page: manage, steps: [step(r.at, residencyAbi, "transferHost", [to], summary)], after: "Nothing to report until the new host accepts." };
    }

    case "accept_host": {
      const pending = await publicClient.readContract({ ...c, functionName: "pendingHost" });
      if (!same(pending, me.address)) fail(403, "You haven't been offered the host role");
      return {
        ...base,
        page,
        steps: [step(r.at, residencyAbi, "acceptHost", [], "Become the host of this residency")],
        after: `POST /api/residencies/${r.at}/host (no body) to sync the new host (the page does this for you)`,
      };
    }

    case "claim": {
      const amount = await publicClient.readContract({ ...c, functionName: "claimable", args: [me.address] });
      if (amount === 0n) fail(400, "You have nothing to claim here");
      return { ...base, page, steps: [step(r.at, residencyAbi, "claim", [], `Claim ${formatUsdc(amount)} USDC`)], after: "Nothing to report." };
    }
  }
}

/** The public origin of this request, as the human's browser sees it (behind nginx too). */
export function siteOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
