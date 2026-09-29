import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth-server";
import { SESSION_COOKIE } from "@/lib/validation";

/** Called right after Firebase sign-in: syncs the user to MongoDB and sets a
 *  lightweight cookie so server-side redirects know someone is signed in. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const res = NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
      },
    });
    res.cookies.set(SESSION_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
