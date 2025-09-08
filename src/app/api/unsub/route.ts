import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createUnsubSignature } from "@/lib/unsub";

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  const sig = searchParams.get("sig") || "";

  if (!id || !sig) {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const expected = createUnsubSignature(id);
  if (expected !== sig) {
    // Do not reveal whether id exists
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await db.delete(comics).where(eq(comics.id, id));
  } catch {
    // swallow detailed DB errors
  }

  // Always return success to avoid leaking information via timing/errors
  return NextResponse.json({ ok: true });
};
