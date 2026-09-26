import "server-only";
import { createPublicClient, http, type Address } from "viem";
import { config } from "../config";
import { residencyAbi } from "../abi";
import { statusFromIndex, type ResidencyStatus } from "../status";

/** Server-side RPC. Prefers a private RPC_URL so the key never ships to the browser. */
export const publicClient = createPublicClient({
  chain: config.chain,
  transport: http(process.env.RPC_URL || config.rpcUrl, { batch: true }),
});

export type ChainResidencyState = {
  status: ResidencyStatus;
  seatCount: number;
  totalStaked: string;
  balance: string;
};

export async function readResidencyState(address: Address): Promise<ChainResidencyState> {
  const c = { address, abi: residencyAbi } as const;
  const [status, seatCount, totalStaked, balance] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "status" }),
    publicClient.readContract({ ...c, functionName: "seatCount" }),
    publicClient.readContract({ ...c, functionName: "totalStaked" }),
    publicClient.readContract({ ...c, functionName: "balance" }),
  ]);
  return {
    status: statusFromIndex(status)!,
    seatCount: Number(seatCount),
    totalStaked: totalStaked.toString(),
    balance: balance.toString(),
  };
}

export async function isStaker(residency: Address, account: Address): Promise<boolean> {
  const m = await publicClient.readContract({ address: residency, abi: residencyAbi, functionName: "getMember", args: [account] });
  return m.staked;
}
