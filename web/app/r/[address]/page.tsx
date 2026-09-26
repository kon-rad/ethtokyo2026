import { notFound } from "next/navigation";
import { isAddress, getAddress } from "viem";
import { getResidency } from "@/lib/server/residencies";
import { ResidencyView } from "./residency-view";

export const dynamic = "force-dynamic";

export default async function ResidencyPage({ params }: PageProps<"/r/[address]">) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const residency = await getResidency(getAddress(address));
  if (!residency) notFound();
  return <ResidencyView residency={residency} />;
}
