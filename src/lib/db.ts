import mongoose from "mongoose";

/**
 * Cached Mongoose connection. Next.js hot-reloads modules in dev, so we keep
 * the connection promise on the global object to avoid opening a new socket
 * on every request.
 */
declare global {
  var __vizpilotMongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = global.__vizpilotMongoose ?? { conn: null, promise: null };
global.__vizpilotMongoose = cached;

function buildUri(): string {
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    throw new Error(
      "MONGODB_URI is missing. Add it to your .env file (see .env.example)."
    );
  }
  // Atlas onboarding writes the URI with <db_username>/<db_password> placeholders.
  // Fill them from MONGODB_USERNAME / MONGODB_PASSWORD if present.
  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;
  let uri = raw.trim().replace(/^["']|["']$/g, "");
  if (user && pass) {
    uri = uri
      .replace("<db_username>", encodeURIComponent(user))
      .replace("<db_password>", encodeURIComponent(pass))
      .replace("<username>", encodeURIComponent(user))
      .replace("<password>", encodeURIComponent(pass));
    // URI without credentials at all -> inject them.
    if (!/\/\/[^/@]+@/.test(uri)) {
      uri = uri.replace(
        /^(mongodb(?:\+srv)?:\/\/)/,
        `$1${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
      );
    }
  }
  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = buildUri();
    const dbName = process.env.MONGODB_DB || "vizpilot";
    cached.promise = mongoose
      .connect(uri, {
        dbName,
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
      })
      .then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
