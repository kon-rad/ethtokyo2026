import { mainnet, anvil, sepolia, type Chain } from "viem/chains";
import type { Address } from "viem";

/** Public (browser-safe) configuration. Everything here ends up in the client bundle. */
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? mainnet.id);

export const chain: Chain =
  chainId === anvil.id ? anvil : chainId === sepolia.id ? sepolia : mainnet;

export const config = {
  chain,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0],
  factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
  factoryDeployBlock: BigInt(process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK ?? "0"),
  usdcAddress: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") as Address,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  worldAppId: (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "app_") as `app_${string}`,
  worldAction: process.env.NEXT_PUBLIC_WORLD_ACTION ?? "ai-city-verify-human",
  worldEnvironment: (process.env.NEXT_PUBLIC_WORLD_ENV === "staging" ? "staging" : "production") as
    | "staging"
    | "production",
  explorerUrl: chain.blockExplorers?.default.url ?? "",
};

export const USDC_DECIMALS = 6;
export const MIN_DURATION_SECONDS = 7 * 24 * 60 * 60;
