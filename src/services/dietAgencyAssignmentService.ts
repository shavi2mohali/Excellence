import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage } from "../lib/firebase";
import { getDietById } from "../lib/firestore";
import type { Agency, Diet, DietAgencyAssignment, ScopeCategory, WorkPackage } from "../types";

export type DietAgencyAssignmentInput = {
  diet: Diet;
  agency: Agency;
  phaseName: string;
  scopeCategories?: ScopeCategory[];
  assignmentOrderNumber?: string;
  assignmentOrderDate?: string;
  scopeSummary?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  remarks?: string;
};

function context() {
  if (!db) throw new Error(getFirebaseConfigurationMessage());
  if (!auth?.currentUser) throw new Error("You must be signed in.");
  return { firestore: db, uid: auth.currentUser.uid };
}

const mapAssignment = (snapshot: { id: string; data(): unknown }) => ({ ...(snapshot.data() as object), id: snapshot.id }) as DietAgencyAssignment;

function firestoreErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
}

function throwLookupError(error: unknown, entity: "DIET" | "executing agency"): never {
  const code = firestoreErrorCode(error);
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    if (import.meta.env.DEV) console.error(`Permission denied while reading the ${entity} record.`, error);
    throw new Error(entity === "DIET" ? "SCERT Admin does not currently have permission to read this DIET record." : "SCERT Admin does not currently have permission to read the executing agency record.");
  }
  if (code === "unavailable" || code === "firestore/unavailable") {
    if (import.meta.env.DEV) console.error(`Firestore unavailable while reading the ${entity} record.`, error);
    throw new Error(entity === "DIET" ? "The DIET record could not be verified because Firestore is unavailable. Please try again." : "The executing agency record could not be verified because Firestore is unavailable. Please try again.");
  }
  throw error;
}

async function resolveDietForActivation(assignmentRef: ReturnType<typeof doc>, assignment: DietAgencyAssignment, uid: string) {
  const { firestore } = context();
  let directDiet;
  try {
    directDiet = await getDietById(assignment.dietId);
  } catch (error) {
    throwLookupError(error, "DIET");
  }

  if (directDiet) return directDiet;

  let dietSnapshot;
  try {
    dietSnapshot = await getDocs(collection(firestore, "diets"));
  } catch (error) {
    throwLookupError(error, "DIET");
  }
  const matches = dietSnapshot.docs.filter((item) => {
    const data = item.data() as Partial<Diet>;
    return data.id === assignment.dietId
      || data.name === assignment.dietId
      || data.district === assignment.dietId
      || (Boolean(assignment.dietName) && data.name === assignment.dietName);
  });
  if (matches.length > 1) {
    throw new Error("The DIET reference stored in this assignment is invalid. Edit the draft and select the DIET again.");
  }
  if (matches.length === 0) throw new Error("The DIET record referenced by this assignment could not be found.");

  const matched = matches[0];
  const resolvedDiet = { ...matched.data(), id: matched.id } as Diet;
  const correction = {
    dietId: matched.id,
    dietName: resolvedDiet.name || assignment.dietName,
    districtId: resolvedDiet.districtId || assignment.districtId || "",
    districtName: resolvedDiet.districtName || resolvedDiet.district || assignment.districtName || "",
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(firestore);
  batch.update(assignmentRef, correction);
  batch.set(doc(collection(firestore, "auditLogs")), {
    entityType: "dietAgencyAssignment",
    entityId: assignment.id,
    action: "repair_diet_reference",
    performedBy: uid,
    performedAt: serverTimestamp(),
    previousData: { dietId: assignment.dietId, dietName: assignment.dietName },
    newData: { dietId: matched.id, dietName: correction.dietName },
    remarks: "Repaired an exact legacy DIET reference before assignment activation.",
  });
  await batch.commit();
  assignment.dietId = matched.id;
  assignment.dietName = correction.dietName;
  return resolvedDiet;
}

export async function getDietAgencyAssignments() {
  const { firestore } = context();
  return (await getDocs(collection(firestore, "dietAgencyAssignments"))).docs.map(mapAssignment);
}

export async function getAssignmentsForDiet(dietId: string) {
  const { firestore } = context();
  return (await getDocs(query(collection(firestore, "dietAgencyAssignments"), where("dietId", "==", dietId)))).docs.map(mapAssignment);
}

export async function getAssignmentsForAgency(agencyId: string) {
  const { firestore } = context();
  return (await getDocs(query(collection(firestore, "dietAgencyAssignments"), where("executingAgencyId", "==", agencyId)))).docs.map(mapAssignment);
}

function validateInput(input: DietAgencyAssignmentInput) {
  if (!input.diet?.id) throw new Error("Select a valid DIET.");
  const category = input.agency.agencyCategory || (input.agency.type === "Private Contractor" ? "private_contractor" : "executing_agency");
  if (!input.agency?.id || !input.agency.active || category !== "executing_agency") {
    throw new Error("Select an active executing agency. Private contractors cannot be assigned.");
  }
}

function assignmentData(input: DietAgencyAssignmentInput) {
  return {
    dietId: input.diet.id, dietName: input.diet.name, phaseId: input.diet.phaseId || "",
    phaseName: input.phaseName || input.diet.phaseYear || "", executingAgencyId: input.agency.id,
    executingAgencyName: input.agency.name, executingAgencyType: input.agency.agencyType || input.agency.type || "",
    districtId: input.diet.districtId || "", districtName: input.diet.districtName || input.diet.district || "",
    scopeCategories: input.scopeCategories || [], assignmentOrderNumber: input.assignmentOrderNumber?.trim() || "",
    assignmentOrderDate: input.assignmentOrderDate || "", scopeSummary: input.scopeSummary?.trim() || "",
    remarks: input.remarks?.trim() || "",
  };
}

export async function createDietAgencyAssignment(input: DietAgencyAssignmentInput) {
  validateInput(input);
  const { firestore, uid } = context();
  let storedDiet;
  try {
    storedDiet = await getDietById(input.diet.id);
  } catch (error) {
    throwLookupError(error, "DIET");
  }
  if (!storedDiet) throw new Error("The selected DIET does not exist in Firestore. Add the DIET master record before creating an assignment.");
  const ref = doc(collection(firestore, "dietAgencyAssignments"));
  const data = { id: ref.id, ...assignmentData({ ...input, diet: storedDiet }), status: "draft", createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() };
  const audit = doc(collection(firestore, "auditLogs"));
  const batch = writeBatch(firestore);
  batch.set(ref, data);
  batch.set(audit, { entityType: "dietAgencyAssignment", entityId: ref.id, action: "agency_assigned_to_diet", performedBy: uid, performedAt: serverTimestamp(), previousData: null, newData: data, remarks: data.remarks });
  await batch.commit();
  return ref.id;
}

export async function updateDietAgencyAssignment(id: string, input: DietAgencyAssignmentInput) {
  validateInput(input);
  const { firestore, uid } = context();
  const ref = doc(firestore, "dietAgencyAssignments", id);
  const previous = await getDoc(ref);
  if (!previous.exists() || previous.data().status !== "draft") throw new Error("Only draft assignments can be edited.");
  const data = { ...assignmentData(input), updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(ref, data);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "dietAgencyAssignment", entityId: id, action: "assignment_updated", performedBy: uid, performedAt: serverTimestamp(), previousData: previous.data(), newData: data, remarks: data.remarks });
  await batch.commit();
}

export async function activateDietAgencyAssignment(id: string) {
  const { firestore, uid } = context();
  const ref = doc(firestore, "dietAgencyAssignments", id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Assignment not found.");
  const assignment = { ...snapshot.data(), id: snapshot.id } as DietAgencyAssignment;
  if (assignment.status !== "draft") throw new Error("Only a draft assignment can be activated.");
  await resolveDietForActivation(ref, assignment, uid);
  let agency;
  try {
    agency = await getDoc(doc(firestore, "agencies", assignment.executingAgencyId));
  } catch (error) {
    throwLookupError(error, "executing agency");
  }
  if (!agency.exists()) throw new Error("The selected executing agency no longer exists.");
  const agencyCategory = agency.data().agencyCategory || (agency.data().type === "Private Contractor" ? "private_contractor" : "executing_agency");
  if (agency.data().active !== true || agencyCategory !== "executing_agency") throw new Error("The selected executing agency is not active or eligible.");
  const next = { status: "active", updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(ref, next);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "dietAgencyAssignment", entityId: id, action: "assignment_activated", performedBy: uid, performedAt: serverTimestamp(), previousData: snapshot.data(), newData: next, remarks: "" });
  await batch.commit();
}

export function canSupersedeAssignment(workPackages: WorkPackage[]) {
  return !workPackages.some((item) => ["tender_in_progress", "awarded", "work_in_progress", "completed"].includes(item.status));
}

export async function supersedeDietAgencyAssignment(id: string, input: DietAgencyAssignmentInput, effectiveDate: string, reason: string) {
  if (!effectiveDate || !reason.trim()) throw new Error("Effective date and reason are required.");
  validateInput(input);
  const { firestore, uid } = context();
  const oldRef = doc(firestore, "dietAgencyAssignments", id);
  const old = await getDoc(oldRef);
  if (!old.exists() || !["draft", "active"].includes(old.data().status)) throw new Error("This assignment cannot be superseded.");
  const newRef = doc(collection(firestore, "dietAgencyAssignments"));
  const newData = { id: newRef.id, ...assignmentData({ ...input, effectiveFrom: effectiveDate, remarks: reason }), supersedesAssignmentId: id, status: "draft", createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(oldRef, { status: "superseded", effectiveTo: effectiveDate, supersededByAssignmentId: newRef.id, remarks: reason.trim(), updatedBy: uid, updatedAt: serverTimestamp() });
  batch.set(newRef, newData);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "dietAgencyAssignment", entityId: id, action: "assignment_superseded", performedBy: uid, performedAt: serverTimestamp(), previousData: old.data(), newData, remarks: reason.trim() });
  await batch.commit();
  return newRef.id;
}

export async function cancelDietAgencyAssignment(id: string, remarks: string) {
  const { firestore, uid } = context();
  const ref = doc(firestore, "dietAgencyAssignments", id);
  const previous = await getDoc(ref);
  if (!previous.exists() || ["cancelled", "superseded", "completed"].includes(previous.data().status)) throw new Error("This assignment cannot be cancelled.");
  const next = { status: "cancelled", remarks: remarks.trim(), updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(ref, next);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "dietAgencyAssignment", entityId: id, action: "assignment_cancelled", performedBy: uid, performedAt: serverTimestamp(), previousData: previous.data(), newData: next, remarks: remarks.trim() });
  await batch.commit();
}
