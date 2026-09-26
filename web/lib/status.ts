/** Mirrors PopupCity.Status. */
export const STATUS = ["Open", "Active", "Failed", "Closed"] as const;
export type CityStatus = (typeof STATUS)[number];

export const STATUS_LABEL: Record<CityStatus, string> = {
  Open: "Accepting applications",
  Active: "Active",
  Failed: "Refunding",
  Closed: "Closed",
};

export function statusFromIndex(i: number | bigint | undefined): CityStatus | undefined {
  return i === undefined ? undefined : STATUS[Number(i)];
}
