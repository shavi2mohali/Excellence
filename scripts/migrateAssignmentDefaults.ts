import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";

const app = initializeApp({ apiKey: process.env.VITE_FIREBASE_API_KEY, authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: process.env.VITE_FIREBASE_PROJECT_ID });
const db = getFirestore(app);
const snapshot = await getDocs(collection(db, "users"));
let batch = writeBatch(db), pending = 0, updated = 0;
for (const item of snapshot.docs) {
  const data = item.data();
  if (data.approvalStatus !== "approved" || (data.assignmentStatus && data.assignedDietIds && data.assignedAgencyIds)) continue;
  batch.update(item.ref, { assignedDietIds: data.assignedDietIds ?? [], assignedAgencyIds: data.assignedAgencyIds ?? [], primaryDietId: data.primaryDietId ?? null, primaryAgencyId: data.primaryAgencyId ?? null, assignmentStatus: data.assignmentStatus ?? "unassigned", updatedAt: serverTimestamp() });
  pending++; updated++;
  if (pending === 400) { await batch.commit(); batch = writeBatch(db); pending = 0; }
}
if (pending) await batch.commit();
console.log(`Updated ${updated} approved user profiles.`);
