import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { activityMaster as fallbackActivities, phases as fallbackPhases } from "../data/masterData";
import { db } from "./firebase";
import type { ActivityMaster, Diet, Phase } from "../types";

async function readCollection<T extends { id: string }>(path: string, fallback: T[], sortField = "id") {
  try {
    if (!db) {
      return fallback;
    }

    const snapshot = await getDocs(query(collection(db, path), orderBy(sortField)));
    if (snapshot.empty) {
      return fallback;
    }

    return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T);
  } catch (error) {
    console.warn(`Using bundled ${path} data because Firestore is unavailable.`, error);
    return fallback;
  }
}

export const dietsCollection = db ? collection(db, "diets") : null;
export const dietDoc = (id: string) => {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return doc(db, "diets", id);
};

export function getPhases() {
  return readCollection<Phase>("phases", fallbackPhases, "order");
}

export function getDiets() {
  if (!db) return Promise.resolve([] as Diet[]);
  return getDocs(query(collection(db, "diets"), orderBy("name"))).then((snapshot) =>
    snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Diet),
  );
}

export async function getDietById(dietId: string): Promise<Diet | null> {
  const id = dietId.trim();
  if (!id) throw new Error("A DIET document ID is required.");
  if (!db) throw new Error("Firebase is not configured.");
  const snapshot = await getDoc(doc(db, "diets", id));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Diet) : null;
}

export function getActivityMaster() {
  return readCollection<ActivityMaster>("activityMaster", fallbackActivities, "serialNo");
}
