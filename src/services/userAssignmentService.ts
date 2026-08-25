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
    .filter((user) => ["diet", "pwd", "rdp"].includes(user.organisationRole ?? ""));
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

type Target = { diet?: Diet; agency?: Agency; remarks: string };

async function assign(user: AppUser, target: Target) {
  const { firestore, adminUid } = requireAdmin();
  const role = user.organisationRole;
  if (user.approvalStatus !== "approved" || user.active !== true || !role || !["diet", "pwd", "rdp"].includes(role)) {
    throw new Error("Only active, approved DIET, PWD, or RDP users can be assigned.");
  }
  if (role === "diet" && !target.diet) throw new Error("Select a DIET.");
  if (role !== "diet" && (!target.agency || target.agency.agencyCategory !== "executing_agency" || target.agency.agencyType !== role)) {
    throw new Error(`Select an active ${role.toUpperCase()} executing agency.`);
  }

  const userRef = doc(firestore, "users", user.uid);
  const newHistoryRef = doc(collection(firestore, "userAssignments"));
  const auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async (transaction) => {
    const currentSnap = await transaction.get(userRef);
    if (!currentSnap.exists()) throw new Error("User profile no longer exists.");
    const current = normaliseAssignmentProfile({ uid: user.uid, ...currentSnap.data() } as AppUser);
    const histories = await getDocs(query(collection(firestore, "userAssignments"), where("userId", "==", user.uid), where("active", "==", true)));
    const reassignment = current.assignmentStatus === "assigned";
    histories.docs.forEach((history) => transaction.update(history.ref, {
      active: false, endedBy: adminUid, endedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    const dietId = target.diet?.id ?? null;
    const agencyId = target.agency?.id ?? null;
    const next = role === "diet" ? {
      primaryDietId: dietId, assignedDietIds: [dietId], primaryAgencyId: current.primaryAgencyId ?? null,
      assignedAgencyIds: current.assignedAgencyIds ?? [],
    } : {
      primaryAgencyId: agencyId, assignedAgencyIds: [agencyId], primaryDietId: current.primaryDietId ?? null,
      assignedDietIds: current.assignedDietIds ?? [],
    };
    const common = { assignmentStatus: "assigned", assignedBy: adminUid, assignedAt: serverTimestamp(), assignmentRemarks: target.remarks.trim(), updatedAt: serverTimestamp() };
    transaction.update(userRef, { ...next, ...common });
    transaction.set(newHistoryRef, {
      id: newHistoryRef.id, userId: user.uid, userEmail: user.email, organisationRole: role,
      systemRole: user.systemRole ?? user.role, assignmentType: reassignment ? "reassignment" : role === "diet" ? "diet_assignment" : "agency_assignment",
      dietId, dietName: target.diet?.name ?? null, agencyId, agencyName: target.agency?.name ?? null,
      previousDietId: current.primaryDietId ?? null, previousAgencyId: current.primaryAgencyId ?? null,
      status: "assigned", remarks: target.remarks.trim(), assignedBy: adminUid, assignedAt: serverTimestamp(),
      endedBy: null, endedAt: null, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef, {
      entityType: "user_assignment", entityId: user.uid,
      action: reassignment ? "reassignment" : `${role}_user_assignment`, performedBy: adminUid,
      performedAt: serverTimestamp(), previousData: { primaryDietId: current.primaryDietId ?? null, primaryAgencyId: current.primaryAgencyId ?? null },
      newData: { dietId, agencyId, assignmentStatus: "assigned" }, remarks: target.remarks.trim(),
    });
  });
}

export const assignUserToDiet = (user: AppUser, diet: Diet, remarks: string) => assign(user, { diet, remarks });
export const assignUserToAgency = (user: AppUser, agency: Agency, remarks: string) => assign(user, { agency, remarks });
export const reassignUser = (user: AppUser, target: Target) => assign(user, target);

export async function deactivateUserAssignment(user: AppUser, remarks: string) {
  if (!remarks.trim()) throw new Error("A deactivation reason is required.");
  const { firestore, adminUid } = requireAdmin();
  const histories = await getDocs(query(collection(firestore, "userAssignments"), where("userId", "==", user.uid), where("active", "==", true)));
  const auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async (transaction) => {
    histories.docs.forEach((history) => transaction.update(history.ref, {
      active: false, endedBy: adminUid, endedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    const dietUser = user.organisationRole === "diet";
    transaction.update(doc(firestore, "users", user.uid), {
      assignmentStatus: "inactive", ...(dietUser ? { primaryDietId: null, assignedDietIds: [] } : { primaryAgencyId: null, assignedAgencyIds: [] }),
      assignmentRemarks: remarks.trim(), updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef, { entityType: "user_assignment", entityId: user.uid, action: "assignment_deactivation", performedBy: adminUid,
      performedAt: serverTimestamp(), previousData: { primaryDietId: user.primaryDietId ?? null, primaryAgencyId: user.primaryAgencyId ?? null },
      newData: { assignmentStatus: "inactive" }, remarks: remarks.trim() });
  });
}
