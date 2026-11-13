import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { getSessionVendorId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const vendorId = await getSessionVendorId();
  if (!vendorId) return Response.json({ vendor: null });
  const [vendor] = await db
    .select({ id: vendors.id, name: vendors.name, email: vendors.email })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  return Response.json({ vendor: vendor ?? null });
}
