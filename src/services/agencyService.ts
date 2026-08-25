import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage, isFirebaseConfigured } from "../lib/firebase";
import type { Agency } from "../types";

export type AgencyInput = Pick<
  Agency,
  "name" | "type" | "contactPersonName" | "contactPersonMobile" | "contactPersonEmail" | "address" | "active"
>;

export function normaliseAgencyName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function agencyClassification(type: Agency["type"]) {
  return {
    agencyCategory: type === "Private Contractor" ? "private_contractor" as const : "executing_agency" as const,
    agencyType: type === "PWD" ? "pwd" as const
      : type === "Rural Development and Panchayat Department" ? "rdp" as const
      : type === "Punjab Mandi Board" ? "punjab_mandi_board" as const
      : type === "PSIEC" ? "psiec" as const : "other_government_agency" as const,
  };
}

function mapAgency(id: string, data: Omit<Agency, "id">): Agency {
  return { ...data, id, ...(!data.agencyCategory ? agencyClassification(data.type) : {}) };
}

function requireFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(getFirebaseConfigurationMessage() || "Agency data is unavailable because Firebase is not configured.");
  }
  return db;
}

function requireAuthenticatedUser() {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in to manage agencies.");
  }
  return user;
}

async function assertUniqueName(name: string, excludedId?: string) {
  const normalisedName = normaliseAgencyName(name);
  const agencies = await getAgencies();
  if (agencies.some((agency) => agency.id !== excludedId && normaliseAgencyName(agency.name) === normalisedName)) {
    throw new Error("An agency with this name already exists.");
  }
}

export async function getAgencies(): Promise<Agency[]> {
  const firestore = requireFirestore();
  try {
    const snapshot = await getDocs(query(collection(firestore, "agencies"), orderBy("name")));
    return snapshot.docs.map((item) => mapAgency(item.id, item.data() as Omit<Agency, "id">));
  } catch {
    throw new Error("Unable to load agencies. Please check your access and try again.");
  }
}

export async function getAgency(id: string): Promise<Agency | null> {
  const firestore = requireFirestore();
  const snapshot = await getDoc(doc(firestore, "agencies", id));
  return snapshot.exists() ? mapAgency(snapshot.id, snapshot.data() as Omit<Agency, "id">) : null;
}

export async function createAgency(input: AgencyInput): Promise<string> {
  if (input.type === "Private Contractor") throw new Error("Add private contractors through the Contractors master.");
  const firestore = requireFirestore();
  const user = requireAuthenticatedUser();
  await assertUniqueName(input.name);
  const ref = doc(collection(firestore, "agencies"));

  try {
    await setDoc(ref, {
      ...input,
      ...agencyClassification(input.type),
      id: ref.id,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch {
    throw new Error("Unable to create the agency. Please check your access and try again.");
  }
}

export async function updateAgency(id: string, input: AgencyInput): Promise<void> {
  if (input.type === "Private Contractor") throw new Error("Private contractor records cannot be created or converted in Civil Agencies.");
  const firestore = requireFirestore();
  const user = requireAuthenticatedUser();
  await assertUniqueName(input.name, id);

  try {
    await updateDoc(doc(firestore, "agencies", id), {
      ...input,
      ...agencyClassification(input.type),
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new Error("Unable to update the agency. Please check your access and try again.");
  }
}

export async function toggleAgencyStatus(agency: Agency): Promise<void> {
  const firestore = requireFirestore();
  const user = requireAuthenticatedUser();

  try {
    await updateDoc(doc(firestore, "agencies", agency.id), {
      active: !agency.active,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new Error("Unable to change the agency status. Please check your access and try again.");
  }
}
