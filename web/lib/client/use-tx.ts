"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hash, TransactionReceipt } from "viem";
import { config } from "../config";
import { errorMessage } from "./api";

type Phase = "idle" | "signing" | "confirming" | "done" | "error";

/** Switch chain if needed → send → wait for the receipt, with a human-readable phase. */
export function useTx() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: config.chain.id });
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  const send = useCallback(
    async <
      const abi extends Abi,
      fn extends ContractFunctionName<abi, "nonpayable" | "payable">,
      args extends ContractFunctionArgs<abi, "nonpayable" | "payable", fn>,
    >(req: { address: `0x${string}`; abi: abi; functionName: fn; args?: args }): Promise<TransactionReceipt> => {
      setError(null);
      setHash(null);
      try {
        if (chainId !== config.chain.id) await switchChainAsync({ chainId: config.chain.id });
        setPhase("signing");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = await writeContractAsync({ ...(req as any), chainId: config.chain.id });
        setHash(h);
        setPhase("confirming");
        const receipt = await client!.waitForTransactionReceipt({ hash: h });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
        setPhase("done");
        return receipt;
      } catch (e) {
        setPhase("error");
        setError(errorMessage(e));
        throw e;
      }
    },
    [chainId, switchChainAsync, writeContractAsync, client],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setHash(null);
  }, []);

  const label =
    phase === "signing" ? "Confirm in your wallet…" : phase === "confirming" ? "Waiting for confirmation…" : null;
  return { send, phase, error, hash, label, busy: phase === "signing" || phase === "confirming", reset, setError };
}
