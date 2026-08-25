import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
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
  if (inlineJson) return JSON.parse(inlineJson);
  if (filePath) {
    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) throw new Error(`Firebase Admin service-account file not found: ${resolvedPath}`);
    return JSON.parse(readFileSync(resolvedPath, "utf8"));
  }
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON.");
}

loadDotEnv(".env");
loadDotEnv(".env.admin");
if (!getApps().length) initializeApp({ credential: cert(serviceAccountFromEnv()) });
const db = getFirestore();

const commonDefaults = {
  projectStatus: "planning",
  status: "planning",
  physicalProgress: 0,
  physicalProgressPercent: 0,
  totalApprovedCost: 0,
  centralShare: 0,
  stateShare: 0,
  fundsReleased: 0,
  expenditure: 0,
  financialProgressPercent: 0,
  assignedAgencyId: "",
  nodalOfficerName: "",
  nodalOfficerMobile: "",
  nodalOfficerEmail: "",
  active: true,
} as const;

const dietSeeds = [
  ["diet_rupnagar", "DIET Rupnagar", "Rupnagar", "rupnagar", "Rupnagar", "phase_2023_24", "Phase 2023-24", "2023-24"],
  ["diet_ludhiana", "DIET Ludhiana", "Ludhiana", "ludhiana", "Ludhiana", "phase_2023_24", "Phase 2023-24", "2023-24"],
  ["diet_ferozepur", "DIET Ferozepur", "Ferozepur", "ferozepur", "Ferozepur", "phase_2023_24", "Phase 2023-24", "2023-24"],
  ["diet_ahmedpur_mansa", "DIET Ahmedpur, Mansa", "Ahmedpur", "mansa", "Mansa", "phase_2025_26", "Phase 2025-26", "2025-26"],
  ["diet_fatehgarh_sahib", "DIET Fatehgarh Sahib", "Fatehgarh Sahib", "fatehgarh_sahib", "Fatehgarh Sahib", "phase_2025_26", "Phase 2025-26", "2025-26"],
  ["diet_verka_amritsar", "DIET Verka, Amritsar", "Verka", "amritsar", "Amritsar", "phase_2025_26", "Phase 2025-26", "2025-26"],
  ["diet_sangrur", "DIET Sangrur", "Sangrur", "sangrur", "Sangrur", "phase_2026_27", "Phase 2026-27", "2026-27"],
  ["diet_deon_bathinda", "DIET Deon, Bathinda", "Deon", "bathinda", "Bathinda", "phase_2026_27", "Phase 2026-27", "2026-27"],
  ["diet_faridkot", "DIET Faridkot", "Faridkot", "faridkot", "Faridkot", "phase_2026_27", "Phase 2026-27", "2026-27"],
  ["diet_barkandi_muktsar", "DIET Barkandi, Sri Muktsar Sahib", "Barkandi", "sri_muktsar_sahib", "Sri Muktsar Sahib", "phase_2026_27", "Phase 2026-27", "2026-27"],
].map(([id, name, shortName, districtId, districtName, phaseId, phaseName, phaseYear]) => ({
  id, name, shortName, districtId, districtName, district: districtName, location: shortName,
  phaseId, phaseName, phaseYear, ...commonDefaults,
}));

const expectedIds = new Set(dietSeeds.map((diet) => diet.id));
let created = 0;
let existed = 0;
let updated = 0;
const errors: string[] = [];

for (const seed of dietSeeds) {
  try {
    const ref = db.collection("diets").doc(seed.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      await ref.set({ ...seed, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      created += 1;
      continue;
    }
    existed += 1;
    const current = snapshot.data() || {};
    const missing = Object.fromEntries(Object.entries(seed).filter(([key]) => current[key] === undefined || current[key] === null));
    if (Object.keys(missing).length) {
      await ref.update(missing);
      updated += 1;
    }
  } catch (error) {
    errors.push(`${seed.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const verifiedSnapshot = await db.collection("diets").get();
const verifiedIds = verifiedSnapshot.docs.map((item) => item.id).filter((id) => expectedIds.has(id)).sort();

type InvalidReference = { collection: string; documentId: string; field: string; value: string };
const invalidReferences: InvalidReference[] = [];
function checkReference(collectionName: string, documentId: string, field: string, value: unknown) {
  if (typeof value === "string" && value && !expectedIds.has(value)) invalidReferences.push({ collection: collectionName, documentId, field, value });
}
for (const collectionName of ["users", "userAssignments", "dietAgencyAssignments", "workPackages"]) {
  const snapshot = await db.collection(collectionName).get();
  for (const item of snapshot.docs) {
    const data = item.data();
    checkReference(collectionName, item.id, "dietId", data.dietId);
    checkReference(collectionName, item.id, "primaryDietId", data.primaryDietId);
    if (Array.isArray(data.assignedDietIds)) data.assignedDietIds.forEach((value: unknown) => checkReference(collectionName, item.id, "assignedDietIds", value));
  }
}

console.log("Centre of Excellence DIET Seed\n");
console.log(`Created: ${created}`);
console.log(`Already existed: ${existed}`);
console.log(`Updated missing fields: ${updated}`);
console.log(`Errors: ${errors.length}\n`);
console.log(`Total expected DIETs: ${dietSeeds.length}`);
console.log(`Total verified in Firestore: ${verifiedIds.length}`);
console.log("Verified IDs:");
verifiedIds.forEach((id) => console.log(`- ${id}`));
console.log(`\nInvalid DIET references found: ${invalidReferences.length}`);
invalidReferences.forEach((item) => console.log(`- ${item.collection}/${item.documentId} ${item.field}=${item.value}`));
errors.forEach((error) => console.error(error));
if (errors.length || verifiedIds.length !== dietSeeds.length) process.exitCode = 1;
