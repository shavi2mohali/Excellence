import { collection, doc, getDocs, orderBy, query, serverTimestamp, runTransaction } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage, isFirebaseConfigured } from "../lib/firebase";
import type { RegistrationRequest, AppUser } from "../types";

import { getRequestedSystemRole } from "../constants/organisationRoles";
import { getAgencies, normaliseAgencyName } from "./agencyService";

export type ApprovalInput = {
  request: RegistrationRequest;
  assignedDietIds: string[];
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

  // Resolve existing organisation identity, never ask the reviewer to assign an organisation.
  const agencies = ["pwd", "rdp"].includes(input.request.organisationRole) ? await getAgencies() : [];
  const auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async transaction => {
    const reviewer = await transaction.get(doc(firestore, "users", reviewerUid));
    if (reviewer.data()?.systemRole !== "scert_admin" || reviewer.data()?.active !== true || reviewer.data()?.approvalStatus !== "approved") throw new Error("Only SCERT Admin can approve registrations.");
    const requestSnap = await transaction.get(requestRef), userSnap = await transaction.get(userRef);
    if (!requestSnap.exists() || !userSnap.exists()) throw new Error("Registration or account no longer exists.");
    const request = requestSnap.data() as RegistrationRequest, user = userSnap.data() as AppUser;
    if (request.status !== "pending" || user.approvalStatus !== "pending") throw new Error("This registration has already been reviewed.");
    if (request.organisationRole !== user.organisationRole || request.organisationRole !== input.request.organisationRole) throw new Error("Organisation identity changed. Reload the request.");
    const role = getRequestedSystemRole(request.organisationRole);
    if (role === "pending_user") throw new Error("Unsupported organisation registration.");
    const ids = [...new Set(input.assignedDietIds.filter(Boolean))];
    if (!ids.length) throw new Error("Select at least one assigned DIET before approval.");
    if (request.organisationRole === "diet" && (ids.length !== 1 || (request.registeredDietId && ids[0] !== request.registeredDietId))) throw new Error("Approve the DIET declared during registration.");
    for (const id of ids) {
      const diet = await transaction.get(doc(firestore, "diets", id));
      if (!diet.exists() || diet.data().active === false) throw new Error("Selected DIET is missing or inactive.");
      if (request.organisationRole === "diet" && (diet.data().districtId ? diet.data().districtId !== request.districtId : diet.data().district !== request.districtName)) throw new Error("DIET must match the registered district.");
    }
    let agencyIds = user.assignedAgencyIds || [];
    let agencyRef = null;
    if (["pwd", "rdp"].includes(request.organisationRole)) {
      const matches = agencies.filter(a => normaliseAgencyName(a.name) === normaliseAgencyName(request.organisationName));
      if (matches.length > 1 || matches.some(a => a.agencyType !== request.organisationRole || a.active === false)) throw new Error("Existing agency identity is ambiguous or inactive. Correct the agency master before approval.");
      agencyRef = doc(firestore, "agencies", matches[0]?.id || `organisation_${request.organisationRole}_${encodeURIComponent(normaliseAgencyName(request.organisationName))}`);
      const existing = await transaction.get(agencyRef);
      if (existing.exists() && (normaliseAgencyName(existing.data().name) !== normaliseAgencyName(request.organisationName) || existing.data().active === false || existing.data().agencyType !== request.organisationRole)) throw new Error("Agency identity conflict.");
      agencyIds = [agencyRef.id];
      if (existing.exists()) agencyRef = null;
    }
    if (agencyRef) transaction.set(agencyRef, {
      id: agencyRef.id, name: request.organisationName, type: request.organisationRole === "pwd" ? "PWD" : "Rural Development and Panchayat Department",
      agencyCategory: "executing_agency", agencyType: request.organisationRole,
      contactPersonName: request.contactPersonName, contactPersonMobile: request.mobile, contactPersonEmail: request.email,
      address: request.officeAddress, divisionName: user.divisionName || "", engineeringDiscipline: user.engineeringDiscipline || "",
      districtId: request.districtId || "", districtName: request.districtName || "", active: true,
      createdBy: reviewerUid, updatedBy: reviewerUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    transaction.update(requestRef, { status: "approved", reviewedBy: reviewerUid, reviewedAt: serverTimestamp(), reviewRemarks: input.remarks.trim(), assignedDietIds: ids });
    transaction.update(userRef, {
      systemRole: role, role, approvalStatus: "approved", approved: true, active: true, isActive: true,
      approvedBy: reviewerUid, approvedAt: serverTimestamp(), assignedDietIds: ids,
      assignedAgencyIds: agencyIds, primaryDietId: ids[0], primaryAgencyId: agencyIds[0] || null,
      assignmentStatus: "assigned", assignedBy: reviewerUid, assignedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef, { entityType: "registration", entityId: requestSnap.id, action: "organisation_approved", performedBy: reviewerUid,
      performedAt: serverTimestamp(), previousData: { approvalStatus: "pending" },
      newData: { organisationRole: request.organisationRole, systemRole: role, assignedDietIds: ids, assignedAgencyIds: agencyIds }, remarks: input.remarks.trim() });
  });
}

export async function rejectRegistration(request: RegistrationRequest, reason: string) {
  const { firestore, reviewerUid } = requireReviewer();
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new Error("Rejection reason is required.");
  }

  const requestRef = doc(firestore, "registrationRequests", request.userId), userRef = doc(firestore, "users", request.userId);
  const auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async transaction => {
    const requestSnap = await transaction.get(requestRef), userSnap = await transaction.get(userRef);
    if (requestSnap.data()?.status !== "pending" || userSnap.data()?.approvalStatus !== "pending") throw new Error("This registration has already been reviewed.");
    transaction.update(requestRef, { status: "rejected", reviewedBy: reviewerUid, reviewedAt: serverTimestamp(), reviewRemarks: trimmedReason });
    transaction.update(userRef, { approvalStatus: "rejected", approved: false, active: false, isActive: false,
      rejectedBy: reviewerUid, rejectedAt: serverTimestamp(), rejectionReason: trimmedReason, updatedAt: serverTimestamp() });
    transaction.set(auditRef, { entityType: "registration", entityId: request.userId, action: "organisation_rejected", performedBy: reviewerUid,
      performedAt: serverTimestamp(), previousData: { approvalStatus: "pending" }, newData: { approvalStatus: "rejected" }, remarks: trimmedReason });
  });
}
