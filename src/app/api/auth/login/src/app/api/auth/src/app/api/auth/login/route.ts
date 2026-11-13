import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { setVendorSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!email || !password || email.length > 254 || password.length > 128) {
      return Response.json({ error: "Mali ang email o password." }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.email, email)).limit(1);
    if (!vendor || !(await verifyPassword(password, vendor.passwordHash))) {
      return Response.json({ error: "Mali ang email o password." }, { status: 401 });
    }
    await setVendorSession(vendor.id);
    return Response.json({ vendor: { id: vendor.id, name: vendor.name, email: vendor.email } });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Hindi makapag-login ngayon. Subukan muli." }, { status: 500 });
  }
}
