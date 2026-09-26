"use client";

import { useAccount, useReadContracts } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { cityAbi, erc20Abi } from "../abi";
import { config } from "../config";
import { statusFromIndex } from "../status";

/** Live onchain state for a city, plus the connected wallet's membership. */
export function useCityChain(city: Address) {
  const { address } = useAccount();
  const me = address ?? zeroAddress;
  const c = { address: city, abi: cityAbi, chainId: config.chain.id } as const;
  const q = useReadContracts({
    contracts: [
      { ...c, functionName: "status" },
      { ...c, functionName: "seatCount" },
      { ...c, functionName: "totalStaked" },
      { ...c, functionName: "balance" },
      { ...c, functionName: "totalWithdrawn" },
      { ...c, functionName: "getMember", args: [me] },
      { ...c, functionName: "claimable", args: [me] },
      { address: config.usdcAddress, abi: erc20Abi, functionName: "allowance", args: [me, city], chainId: config.chain.id },
      { address: config.usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [me], chainId: config.chain.id },
    ],
    query: { refetchInterval: 15_000 },
  });
  const r = q.data;
  return {
    ...q,
    status: statusFromIndex(r?.[0].result as number | undefined),
    seatCount: Number(r?.[1].result ?? 0n),
    totalStaked: (r?.[2].result as bigint | undefined) ?? 0n,
    balance: (r?.[3].result as bigint | undefined) ?? 0n,
    totalWithdrawn: (r?.[4].result as bigint | undefined) ?? 0n,
    member: r?.[5].result as { approved: boolean; staked: boolean; claimed: boolean; bedId: number; price: bigint } | undefined,
    claimable: (r?.[6].result as bigint | undefined) ?? 0n,
    allowance: (r?.[7].result as bigint | undefined) ?? 0n,
    usdcBalance: (r?.[8].result as bigint | undefined) ?? 0n,
  };
}
