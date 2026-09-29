import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { hasAIProvider, providerStatus } from "@/lib/ai";

export async function GET() {
  let db = "ok";
  try {
    await connectDB();
  } catch (err) {
    db = err instanceof Error ? err.message : "error";
  }
  return NextResponse.json({
    ok: db === "ok",
    db,
    ai: hasAIProvider(),
    providers: providerStatus().filter((p) => p.configured).map((p) => ({ id: p.id, state: p.state })),
    firebase: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  });
}
