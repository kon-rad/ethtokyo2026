import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS, config } from "./config";

export function formatUsdc(units: bigint | string | number): string {
  const n = Number(formatUnits(BigInt(units), USDC_DECIMALS));
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function toUsdcUnits(amount: string): bigint {
  return parseUnits(amount.trim(), USDC_DECIMALS);
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function formatDate(unixSeconds: number | bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(unixSeconds: number | bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function durationLabel(start: number, end: number): string {
  const days = Math.round((end - start) / 86400);
  if (days % 7 === 0) return `${days / 7} week${days === 7 ? "" : "s"}`;
  return `${days} days`;
}

export function txUrl(hash: string): string {
  return `${config.explorerUrl}/tx/${hash}`;
}

export function addressUrl(addr: string): string {
  return `${config.explorerUrl}/address/${addr}`;
}

/** Deterministic two-colour gradient from a string, for city covers. */
export function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 40 + ((h >> 9) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${a} 80% 62%), hsl(${b} 75% 52%))`;
}
