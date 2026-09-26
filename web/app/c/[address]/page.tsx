import { notFound } from "next/navigation";
import { isAddress, getAddress } from "viem";
import { getCity } from "@/lib/server/cities";
import { CityView } from "./city-view";

export const dynamic = "force-dynamic";

export default async function CityPage({ params }: PageProps<"/c/[address]">) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const city = await getCity(getAddress(address));
  if (!city) notFound();
  return <CityView city={city} />;
}
