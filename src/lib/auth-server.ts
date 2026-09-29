import "server-only";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, type UserDoc } from "@/lib/models/User";
import { verifyIdToken } from "@/lib/firebase/admin";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Reads the Firebase ID token from the Authorization header, verifies it and
 * returns (creating if needed) the matching user in MongoDB.
 */
export async function requireUser(req: Request): Promise<UserDoc> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AuthError("Missing auth token");

  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch {
    throw new AuthError("Invalid or expired session. Please sign in again.");
  }

  await connectDB();
  const provider = decoded.firebase?.sign_in_provider || "password";
  const update = {
    $set: {
      email: decoded.email || "",
      name: decoded.name || "",
      photoURL: decoded.picture || "",
      provider,
      lastLoginAt: new Date(),
    },
    $setOnInsert: { firebaseUid: decoded.uid },
  };
  try {
    const user = await User.findOneAndUpdate({ firebaseUid: decoded.uid }, update, { upsert: true, returnDocument: "after" });
    return user!;
  } catch (err) {
    // Two requests can race to create the same user (sign-up fires the auth
    // listener and the explicit session sync at once). Retry once without upsert.
    if ((err as { code?: number }).code === 11000) {
      const user = await User.findOneAndUpdate({ firebaseUid: decoded.uid }, update, { returnDocument: "after" });
      if (user) return user;
    }
    throw err;
  }
}

export function jsonError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Something went wrong";
  console.error("[api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
