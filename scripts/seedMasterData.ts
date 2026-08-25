import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { sampleAgencies } from "../src/data/agencies";
import { activityMaster, diets, phases } from "../src/data/masterData";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  throw new Error("Missing Firebase environment variables. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function upsert(path: string, id: string, data: Record<string, unknown>) {
  const ref = doc(db, path, id);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

async function createIfMissing(path: string, id: string, data: Record<string, unknown>) {
  const ref = doc(db, path, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

async function seed() {
  await Promise.all(phases.map((phase) => upsert("phases", phase.id, phase)));
  await Promise.all(diets.map((diet) => upsert("diets", diet.id, diet)));
  await Promise.all(activityMaster.map((activity) => upsert("activityMaster", activity.id, activity)));
  await Promise.all(sampleAgencies.map((agency) => createIfMissing("agencies", agency.id, {
    districtId: "", districtName: "Punjab", divisionName: "", ...agency,
  })));

  console.log(
    `Seeded ${phases.length} phases, ${diets.length} DIETs, ${activityMaster.length} activities, and ${sampleAgencies.length} agencies.`,
  );
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
