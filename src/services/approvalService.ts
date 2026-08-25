import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage, isFirebaseConfigured } from "../lib/firebase";
import type { RegistrationRequest, SystemRole } from "../types";

export type ApprovalInput = {
  request: RegistrationRequest;
  systemRole: SystemRole;
  assignedDietIds: string[];
  assignedAgencyIds: string[];
  remarks: string;
};

function requireReviewer() {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error(
      !isFirebaseConfigured
        ? getFirebaseConfigurationMessage()
        : "You must be signed in as an SCERT administrator to review registrations.",
    );
  }

  return { firestore: db, reviewerUid: auth.currentUser.uid };
}

export async function getRegistrationRequests(): Promise<RegistrationRequest[]> {
  if (!isFirebaseConfigured || !db) {
    throw new Error(getFirebaseConfigurationMessage() || "Firebase is not configured or registration requests could not be loaded.");
  }

  const snapshot = await getDocs(query(collection(db, "registrationRequests"), orderBy("submittedAt", "desc")));
  return snapshot.docs.map((item) => ({ userId: item.id, ...item.data() }) as RegistrationRequest);
}

export async function approveRegistration(input: ApprovalInput) {
  const { firestore, reviewerUid } = requireReviewer();
  const requestRef = doc(firestore, "registrationRequests", input.request.userId);
  const userRef = doc(firestore, "users", input.request.userId);

  await updateDoc(requestRef, {
    status: "approved",
    requestedSystemRole: input.systemRole,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    reviewRemarks: input.remarks.trim(),
  });

  await updateDoc(userRef, {
    systemRole: input.systemRole,
    role: input.systemRole,
    approvalStatus: "approved",
    approved: true,
    active: true,
    isActive: true,
    approvedBy: reviewerUid,
    approvedAt: serverTimestamp(),
    assignedDietIds: input.assignedDietIds,
    assignedAgencyIds: input.assignedAgencyIds,
    primaryDietId: input.assignedDietIds[0] ?? null,
    primaryAgencyId: input.assignedAgencyIds[0] ?? null,
    assignmentStatus: input.assignedDietIds.length || input.assignedAgencyIds.length ? "assigned" : "unassigned",
    updatedAt: serverTimestamp(),
  });
}

export async function rejectRegistration(request: RegistrationRequest, reason: string) {
  const { firestore, reviewerUid } = requireReviewer();
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new Error("Rejection reason is required.");
  }

  await updateDoc(doc(firestore, "registrationRequests", request.userId), {
    status: "rejected",
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    reviewRemarks: trimmedReason,
  });

  await updateDoc(doc(firestore, "users", request.userId), {
    approvalStatus: "rejected",
    approved: false,
    active: false,
    isActive: false,
    rejectedBy: reviewerUid,
    rejectedAt: serverTimestamp(),
    rejectionReason: trimmedReason,
    updatedAt: serverTimestamp(),
  });
}
