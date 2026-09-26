/** Mirrors PopupCity.Status. */
export const STATUS = ["Open", "Active", "Failed", "Closed"] as const;
export type ResidencyStatus = (typeof STATUS)[number];

export const STATUS_LABEL: Record<ResidencyStatus, string> = {
  Open: "Accepting applications",
  Active: "Active",
  Failed: "Refunding",
  Closed: "Closed",
};

export function statusFromIndex(i: number | bigint | undefined): ResidencyStatus | undefined {
  return i === undefined ? undefined : STATUS[Number(i)];
}
