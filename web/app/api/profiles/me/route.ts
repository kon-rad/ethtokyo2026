import { sql } from "@/lib/db";
import { profileInput } from "@/lib/metadata";
import { getProfile } from "@/lib/server/profiles";
import { requireSession, requireVerified, handle, fail, readJson } from "@/lib/server/http";

/** The signed-in wallet's own profile, listed or not. */
export const GET = handle(async () => {
  const me = await requireSession();
  return Response.json({ profile: await getProfile(me.address) });
});

/** Create or update your profile. Verified humans only, so the directory is one entry per person. */
export const PUT = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = profileInput.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid profile");
  const v = parsed.data;
  await sql`
    INSERT INTO profiles (address, name, bio, links, listed)
    VALUES (${me.address.toLowerCase()}, ${v.name}, ${v.bio}, ${sql.json(v.links)}, ${v.listed})
    ON CONFLICT (address) DO UPDATE
      SET name = EXCLUDED.name, bio = EXCLUDED.bio, links = EXCLUDED.links, listed = EXCLUDED.listed,
          updated_at = now()`;
  return Response.json({ profile: await getProfile(me.address) });
});
