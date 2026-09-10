import {
  collection, doc, getDocs, query, runTransaction, serverTimestamp, where,
} from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage, isFirebaseConfigured } from "../lib/firebase";
import type { Agency, AppUser, Diet, OrganisationRole, UserAssignment } from "../types";

function requireAdmin() {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error(getFirebaseConfigurationMessage() || "You must be signed in as a SCERT administrator.");
  }
  return { firestore: db, adminUid: auth.currentUser.uid };
}

export function normaliseAssignmentProfile(user: AppUser): AppUser {
  return {
    ...user,
    assignedDietIds: Array.isArray(user.assignedDietIds) ? user.assignedDietIds : [],
    assignedAgencyIds: Array.isArray(user.assignedAgencyIds) ? user.assignedAgencyIds : [],
    primaryDietId: user.primaryDietId ?? null,
    primaryAgencyId: user.primaryAgencyId ?? null,
    assignmentStatus: user.assignmentStatus ?? "unassigned",
  };
}

export async function getApprovedAssignableUsers(): Promise<AppUser[]> {
  const { firestore } = requireAdmin();
  const snapshot = await getDocs(query(collection(firestore, "users"), where("approvalStatus", "==", "approved")));
  return snapshot.docs
    .map((item) => normaliseAssignmentProfile({ uid: item.id, ...item.data() } as AppUser))
    .filter((user) => ["diet", "pwd", "rdp", "architecture_department"].includes(user.organisationRole ?? ""));
}

export async function getAssignableDiets(): Promise<Diet[]> {
  const { firestore } = requireAdmin();
  const snapshot = await getDocs(collection(firestore, "diets"));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Diet).filter((diet) => diet.active !== false);
}

export async function getAssignableAgencies(role?: OrganisationRole): Promise<Agency[]> {
  const { firestore } = requireAdmin();
  const snapshot = await getDocs(collection(firestore, "agencies"));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Agency).filter((agency) => {
    if (!agency.active || agency.agencyCategory !== "executing_agency") return false;
    return role === "pwd" ? agency.agencyType === "pwd" : role === "rdp" ? agency.agencyType === "rdp" : true;
  });
}

export async function getUserAssignmentHistory(userId: string): Promise<UserAssignment[]> {
  const { firestore } = requireAdmin();
  const snapshot = await getDocs(query(collection(firestore, "userAssignments"), where("userId", "==", userId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as UserAssignment)
    .sort((a, b) => Number(b.active) - Number(a.active));
}

export async function assignOrganisationDiets(user: AppUser, diets: Diet[], remarks: string) {
  const { firestore, adminUid } = requireAdmin();
  if (!["diet", "pwd", "rdp", "architecture_department"].includes(user.organisationRole || "") || user.approvalStatus !== "approved" || user.active !== true) throw new Error("Only an active, approved organisation can be reassigned.");
  if (!diets.length) throw new Error("Select at least one DIET.");
  if (user.organisationRole === "diet" && diets.length !== 1) throw new Error("Select exactly one DIET.");
  const userRef = doc(firestore, "users", user.uid), historyRef = doc(collection(firestore, "userAssignments")), auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async transaction => {
    const snap = await transaction.get(userRef); if (!snap.exists()) throw new Error("User profile no longer exists.");
    const current = normaliseAssignmentProfile({ uid: user.uid, ...snap.data() } as AppUser);
    if (current.approvalStatus !== "approved" || current.active !== true) throw new Error("Account is no longer active and approved.");
    for (const diet of diets) { const master = await transaction.get(doc(firestore, "diets", diet.id)); if (!master.exists() || master.data().active === false) throw new Error("DIET is missing or inactive."); }
    const histories = await getDocs(query(collection(firestore, "userAssignments"), where("userId", "==", user.uid), where("active", "==", true)));
    histories.docs.forEach(item => transaction.update(item.ref, { active: false, endedBy: adminUid, endedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const ids = diets.map(diet => diet.id), names = diets.map(diet => diet.name), reassignment = current.assignmentStatus === "assigned";
    transaction.update(userRef, { assignedDietIds: ids, primaryDietId: ids[0] ?? null,  assignmentStatus: "assigned", assignedBy: adminUid, assignedAt: serverTimestamp(), assignmentRemarks: remarks.trim(), updatedAt: serverTimestamp() });
    transaction.set(historyRef, { id: historyRef.id, userId: user.uid, userEmail: user.email, organisationRole: user.organisationRole, systemRole: current.systemRole || current.role, assignmentType: reassignment ? "reassignment" : "diet_assignment", architectureZone: user.architectureZone ?? null, assignedDietIds: ids, assignedDietNames: names, dietId: ids[0] ?? null, dietName: names[0] ?? null, agencyId: null, agencyName: null, previousDietId: current.primaryDietId ?? null, previousAgencyId: null, status: "assigned", remarks: remarks.trim(), assignedBy: adminUid, assignedAt: serverTimestamp(), endedBy: null, endedAt: null, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(auditRef, { entityType: "user_assignment", entityId: user.uid, action: reassignment ? "reassignment" : "diet_assignment", performedBy: adminUid, performedAt: serverTimestamp(), previousData: { assignedDietIds: current.assignedDietIds ?? [] }, newData: { assignedDietIds: ids, assignmentStatus: "assigned" }, remarks: remarks.trim() });
  });
}

export async function deactivateUserAssignment(user: AppUser, remarks: string) {
  if (!remarks.trim()) throw new Error("A deactivation reason is required.");
  const { firestore, adminUid } = requireAdmin();
  const histories = await getDocs(query(collection(firestore, "userAssignments"), where("userId", "==", user.uid), where("active", "==", true)));
  const auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async (transaction) => {
    histories.docs.forEach((history) => transaction.update(history.ref, {
      active: false, endedBy: adminUid, endedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    transaction.update(doc(firestore, "users", user.uid), {
      assignmentStatus: "inactive", primaryDietId: null, assignedDietIds: [],
      assignmentRemarks: remarks.trim(), updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef, { entityType: "user_assignment", entityId: user.uid, action: "assignment_deactivation", performedBy: adminUid,
      performedAt: serverTimestamp(), previousData: { primaryDietId: user.primaryDietId ?? null, primaryAgencyId: user.primaryAgencyId ?? null },
      newData: { assignmentStatus: "inactive" }, remarks: remarks.trim() });
  });
}
