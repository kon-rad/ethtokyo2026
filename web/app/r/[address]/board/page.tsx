import { notFound } from "next/navigation";
import { isAddress, getAddress } from "viem";
import { getResidency } from "@/lib/server/residencies";
import { BoardClient } from "./board-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BoardPage({ params }: PageProps<"/r/[address]/board">) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const residency = await getResidency(getAddress(address));
  if (!residency) notFound();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <BoardClient residency={residency} />
    </div>
  );
}