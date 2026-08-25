import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, getFirebaseConfigurationMessage } from "../lib/firebase";
import type { AccessScope, AppUser } from "../types";
import { getUserAccessScope } from "../services/accessScopeService";

type AuthContextValue = {
  firebaseUser: User | null;
  profile: AppUser | null;
  accessScope: AccessScope | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AppUser | null>;
};

export class AuthAccessError extends Error {
  status?: string;
  summary?: Record<string, string>;

  constructor(message: string, status?: string, summary?: Record<string, string>) {
    super(message);
    this.name = "AuthAccessError";
    this.status = status;
    this.summary = summary;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function isInvalidApiKeyError(error: unknown) {
  const code = firebaseErrorCode(error);
  const message = error instanceof Error ? error.message : "";
  return code === "auth/invalid-api-key"
    || code.includes("api-key-not-valid")
    || message.includes("api-key-not-valid")
    || message.includes("valid-api-key");
}

function logDevelopmentError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(context, firebaseErrorCode(error), error);
  }
}

function isApprovedActiveProfile(profile: AppUser) {
  return (profile.approvalStatus === "approved" || profile.approved === true)
    && (profile.active === true || profile.isActive === true);
}

function profileSummary(profile: AppUser) {
  return {
    organisationName: profile.organisationName || profile.displayName || profile.name || "Submitted organisation",
    organisationRoleLabel: profile.organisationRoleLabel || profile.systemRole || profile.role || "Registration role",
    districtName: profile.districtName || "Selected district",
    status: profile.approvalStatus || "pending",
    rejectionReason: profile.rejectionReason || "",
  };
}

async function loadApprovedProfile(user: User): Promise<AppUser> {
  if (!db) {
    throw new AuthAccessError(getFirebaseConfigurationMessage() || "Cloud Firestore is not configured.");
  }

  if (import.meta.env.DEV) {
    console.log("Authenticated UID:", user.uid);
    console.log("Profile path:", `users/${user.uid}`);
  }

  let snapshot;
  try {
    snapshot = await getDoc(doc(db, "users", user.uid));
  } catch (error) {
    logDevelopmentError("Unable to read the authenticated user profile.", error);
    if (firebaseErrorCode(error) === "permission-denied") {
      throw new AuthAccessError("Authentication succeeded, but Firestore denied access to the user profile.");
    }
    throw new AuthAccessError("Authentication succeeded, but the user profile could not be loaded.");
  }

  if (!snapshot.exists()) {
    throw new AuthAccessError("Authentication succeeded, but no matching Firestore user profile was found. Please contact SCERT Punjab.");
  }

  const profile = { uid: user.uid, ...snapshot.data() } as AppUser;
  if (profile.approvalStatus === "pending") {
    throw new AuthAccessError("Your registration is pending SCERT approval.", "pending", profileSummary(profile));
  }
  if (profile.approvalStatus === "rejected") {
    throw new AuthAccessError(
      `Registration rejected${profile.rejectionReason ? `: ${profile.rejectionReason}` : "."}`,
      "rejected",
      profileSummary(profile),
    );
  }
  if (profile.approvalStatus === "suspended") {
    throw new AuthAccessError("This account is suspended. Please contact SCERT Punjab.", "suspended", profileSummary(profile));
  }
  if (!isApprovedActiveProfile(profile)) {
    throw new AuthAccessError("This account is not active. Please contact SCERT Punjab.", profile.approvalStatus, profileSummary(profile));
  }

  return {
    ...profile,
    assignedDietIds: Array.isArray(profile.assignedDietIds) && profile.assignedDietIds.length ? profile.assignedDietIds : profile.primaryDietId ? [profile.primaryDietId] : [],
    assignedAgencyIds: Array.isArray(profile.assignedAgencyIds) && profile.assignedAgencyIds.length ? profile.assignedAgencyIds : profile.primaryAgencyId ? [profile.primaryAgencyId] : [],
    primaryDietId: profile.primaryDietId ?? null,
    primaryAgencyId: profile.primaryAgencyId ?? null,
    assignmentStatus: profile.assignmentStatus ?? "unassigned",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [accessScope, setAccessScope] = useState<AccessScope | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const configuredAuth = auth;

    return onAuthStateChanged(configuredAuth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        setAccessScope(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const authorisedProfile = await loadApprovedProfile(user);
        const resolvedScope = await getUserAccessScope(authorisedProfile);
        setFirebaseUser(user);
        setProfile(authorisedProfile);
        setAccessScope(resolvedScope);
      } catch (error) {
        logDevelopmentError("Restored session failed SCERT authorization.", error);
        setFirebaseUser(null);
        setProfile(null);
        setAccessScope(null);
        await signOut(configuredAuth);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      accessScope,
      loading,
      login: async (email, password) => {
        if (!auth || !db) {
          throw new AuthAccessError(getFirebaseConfigurationMessage() || "Firebase Authentication or Cloud Firestore is not configured.");
        }

        setLoading(true);
        try {
          const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
          const authorisedProfile = await loadApprovedProfile(credential.user);
          const resolvedScope = await getUserAccessScope(authorisedProfile);
          setFirebaseUser(credential.user);
          setProfile(authorisedProfile);
          setAccessScope(resolvedScope);
          return authorisedProfile;
        } catch (error) {
          logDevelopmentError("SCERT sign-in failed.", error);
          setFirebaseUser(null);
          setProfile(null);
          setAccessScope(null);

          if (auth.currentUser) {
            await signOut(auth);
          }

          const code = firebaseErrorCode(error);
          if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
            throw new AuthAccessError("Incorrect email or password.");
          }
          if (code === "auth/user-disabled") {
            throw new AuthAccessError("This Firebase Authentication account is disabled.");
          }
          if (isInvalidApiKeyError(error)) {
            throw new AuthAccessError("The Firebase API key loaded by the app is invalid. Recheck .env.local and restart Vite.");
          }
          if (error instanceof AuthAccessError) {
            throw error;
          }
          throw new AuthAccessError("Unable to sign in. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      logout: () => {
        if (!auth) return Promise.resolve();
        return signOut(auth);
      },
      refreshProfile: async () => {
        if (!auth?.currentUser) return null;
        const refreshed = await loadApprovedProfile(auth.currentUser);
        const resolvedScope = await getUserAccessScope(refreshed);
        setProfile(refreshed);
        setAccessScope(resolvedScope);
        return refreshed;
      },
    }),
    [accessScope, firebaseUser, loading, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
