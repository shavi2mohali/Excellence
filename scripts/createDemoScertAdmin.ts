import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadDotEnv(fileName: string) {
  const envPath = resolve(process.cwd(), fileName);
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

function serviceAccountFromEnv() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  if (filePath) {
    return JSON.parse(readFileSync(resolve(filePath), "utf8"));
  }

  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON.");
}

loadDotEnv(".env");
loadDotEnv(".env.admin");

const email = process.env.DEMO_SCERT_ADMIN_EMAIL;
const password = process.env.DEMO_SCERT_ADMIN_PASSWORD;
const displayName = process.env.DEMO_SCERT_ADMIN_NAME || "Demo SCERT Administrator";

if (!email || !password) {
  throw new Error("Set DEMO_SCERT_ADMIN_EMAIL and DEMO_SCERT_ADMIN_PASSWORD in your local environment.");
}

const demoEmail = email;
const demoPassword = password;

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccountFromEnv()),
  });
}

const auth = getAuth();
const db = getFirestore();

async function findOrCreateUser() {
  try {
    return await auth.getUserByEmail(demoEmail);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") {
      return auth.createUser({ email: demoEmail, password: demoPassword, displayName, emailVerified: true });
    }
    throw error;
  }
}

async function main() {
  const user = await findOrCreateUser();
  await db.doc(`users/${user.uid}`).set(
    {
      uid: user.uid,
      email: demoEmail,
      displayName,
      name: displayName,
      systemRole: "scert_admin",
      role: "scert_admin",
      approvalStatus: "approved",
      approved: true,
      active: true,
      isActive: true,
      assignedDietIds: [],
      assignedAgencyIds: [],
      demoDevelopmentAccount: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.warn("WARNING: Demo SCERT administrator credentials are for development only. Delete or disable this account before production.");
  console.log(`Demo SCERT administrator is ready: ${demoEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
