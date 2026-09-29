import "server-only";
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";

/**
 * Verifies Firebase ID tokens on the server.
 *
 * We check the token ourselves with `jose` (Google's public signing keys +
 * issuer/audience checks) instead of loading `firebase-admin`. firebase-admin
 * pulls in a CommonJS package that `require()`s the ESM-only `jose`, which
 * crashes on serverless runtimes such as Vercel. This is the same check
 * firebase-admin does for `verifyIdToken`.
 */

export interface DecodedIdToken extends JWTPayload {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  firebase?: { sign_in_provider?: string };
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

function projectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Firebase project id is not configured");
  return id;
}

function toDecoded(payload: JWTPayload): DecodedIdToken {
  const sub = payload.sub;
  if (!sub) throw new Error("Token has no subject");
  return { ...payload, uid: sub } as DecodedIdToken;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const pid = projectId();

  // Local Auth emulator: tokens are unsigned, so only check who they're for.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const payload = decodeJwt(token);
    if (payload.aud !== pid) throw new Error("Token is for a different project");
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("Token expired");
    return toDecoded(payload);
  }

  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${pid}`,
    audience: pid,
    algorithms: ["RS256"],
  });
  if (typeof payload.auth_time === "number" && payload.auth_time * 1000 > Date.now() + 5 * 60_000) {
    throw new Error("Token auth time is in the future");
  }
  return toDecoded(payload);
}
