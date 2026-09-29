"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "@/lib/firebase/client";

export interface Profile {
  id: string;
  email: string;
  name: string;
  photoURL: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const inflight = new Map<string, Promise<Profile | null>>();

async function syncSession(user: User | null): Promise<Profile | null> {
  if (user) {
    // De-duplicate concurrent syncs for the same user (auth listener + explicit call).
    const existing = inflight.get(user.uid);
    if (existing) return existing;
    const p = syncSessionInner(user).finally(() => inflight.delete(user.uid));
    inflight.set(user.uid, p);
    return p;
  }
  return syncSessionInner(user);
}

async function syncSessionInner(user: User | null): Promise<Profile | null> {
  if (!user) {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    return null;
  }
  const token = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not start your session");
  }
  const data = await res.json();
  return data.user as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const auth = getFirebaseAuth();
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      // Only hit the server when the signed-in identity changes (not on every token refresh).
      if ((u?.uid ?? null) !== lastUid.current) {
        lastUid.current = u?.uid ?? null;
        try {
          const p = await syncSession(u);
          setProfile(p);
        } catch (err) {
          console.error(err);
          setProfile(null);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      await cred.user.getIdToken(true); // refresh so the token carries the name
    }
    lastUid.current = cred.user.uid;
    const p = await syncSession(cred.user);
    setUser(cred.user);
    setProfile(p);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    lastUid.current = cred.user.uid;
    const p = await syncSession(cred.user);
    setUser(cred.user);
    setProfile(p);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const cred = await signInWithPopup(auth, googleProvider);
    lastUid.current = cred.user.uid;
    const p = await syncSession(cred.user);
    setUser(cred.user);
    setProfile(p);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
    lastUid.current = null;
    await syncSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      configured: isFirebaseConfigured,
      signUp,
      signIn,
      signInWithGoogle,
      resetPassword,
      signOut,
    }),
    [user, profile, loading, signUp, signIn, signInWithGoogle, resetPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Friendly copy for Firebase auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account. Try logging in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in window was closed before finishing.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled in Firebase yet.";
    default:
      return (err as Error)?.message || "Something went wrong. Please try again.";
  }
}
