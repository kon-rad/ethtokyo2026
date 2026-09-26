import { launchInput, buildMetadata, canonicalJson, metadataHash } from "@/lib/metadata";
import { requireVerified, handle, fail, readJson } from "@/lib/server/http";

/** Validates the launch form and returns the canonical metadata + hash for createCity. */
export const POST = handle(async (req: Request) => {
  await requireVerified();
  const parsed = launchInput.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(400, issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid form");
  }
  const v = parsed.data;
  const json = canonicalJson(buildMetadata(v));
  return Response.json({
    metadataJson: json,
    metadataHash: metadataHash(json),
    params: {
      startTime: v.startTime,
      endTime: v.endTime,
      deadline: v.deadline,
      minSeats: v.minSeats,
      maxSeats: v.maxSeats,
    },
  });
});
