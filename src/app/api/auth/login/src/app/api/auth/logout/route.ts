import { clearVendorSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearVendorSession();
  return Response.json({ ok: true });
}
