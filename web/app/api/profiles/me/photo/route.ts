import { sql } from "@/lib/db";
import { requireSession, handle, fail } from "@/lib/server/http";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Upload a profile photo (PNG, JPEG or WebP, up to 2 MB). Create the profile first. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "Attach a photo");
  if (file.size === 0 || file.size > MAX_BYTES) fail(400, "Photos must be under 2 MB");
  if (!ALLOWED_TYPES.has(file.type)) fail(400, "Photos must be PNG, JPEG or WebP");

  const bytes = Buffer.from(await file.arrayBuffer());
  const [row] = await sql`
    UPDATE profiles SET photo = ${bytes}, photo_mime = ${file.type}, updated_at = now()
    WHERE address = ${me.address.toLowerCase()} RETURNING address`;
  if (!row) fail(400, "Save your profile before adding a photo");
  return Response.json({ ok: true });
});

export const DELETE = handle(async () => {
  const me = await requireSession();
  await sql`UPDATE profiles SET photo = NULL, photo_mime = NULL, updated_at = now() WHERE address = ${me.address.toLowerCase()}`;
  return Response.json({ ok: true });
});
