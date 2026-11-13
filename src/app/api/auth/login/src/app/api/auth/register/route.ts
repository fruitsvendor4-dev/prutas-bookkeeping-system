import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { hashPassword, setVendorSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { name?: unknown; email?: unknown; password?: unknown };
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Pakilagay ang wastong pangalan at email." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return Response.json({ error: "Gumamit ng password na hindi bababa sa 8 character." }, { status: 400 });
    }

    const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.email, email)).limit(1);
    if (existing.length) return Response.json({ error: "May account na gamit ang email na ito." }, { status: 409 });

    const [vendor] = await db
      .insert(vendors)
      .values({ name, email, passwordHash: await hashPassword(password) })
      .returning({ id: vendors.id, name: vendors.name, email: vendors.email });
    await setVendorSession(vendor.id);
    return Response.json({ vendor }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return Response.json({ error: "May account na gamit ang email na ito." }, { status: 409 });
    }
    console.error("Registration error:", error);
    return Response.json({ error: "Hindi nakagawa ng account. Subukan muli." }, { status: 500 });
  }
}
