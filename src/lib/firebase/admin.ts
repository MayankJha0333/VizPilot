import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

let app: App | undefined;

function ensureApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount) {
    // Optional: a full service-account JSON gives access to more admin features.
    const parsed = JSON.parse(serviceAccount);
    app = initializeApp({ credential: cert(parsed), projectId: parsed.project_id || projectId });
  } else {
    // verifyIdToken only needs the project id (public certs are fetched from Google).
    app = initializeApp({ projectId });
  }
  return app;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const auth = getAuth(ensureApp());
  return auth.verifyIdToken(token);
}
