import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage } from "../lib/firebase";
import { maskGst, maskPan, normalizeGst, normalizeMobile, normalizePan } from "../utils/contractorIdentifiers";
import type { AppUser, Contractor, ContractorCategory, ContractorEntityType } from "../types";

export type ContractorInput = {
  legalName: string; tradeName?: string; entityType: ContractorEntityType; contractorCategories: ContractorCategory[];
  registrationNumber?: string; registrationAuthority?: string; contractorClass?: string; gstNumber?: string; panNumber?: string;
  contactPersonName: string; designation?: string; mobile: string; alternateMobile?: string; email?: string;
  addressLine1: string; addressLine2?: string; districtId?: string; districtName?: string; state: string; pinCode?: string;
  active: boolean; remarks?: string;
};

function requireContext() {
  if (!db) throw new Error(getFirebaseConfigurationMessage());
  if (!auth?.currentUser) throw new Error("You must be signed in.");
  return { firestore: db, uid: auth.currentUser.uid };
}
const mapContractor = (item: { id: string; data(): unknown }) => ({ ...(item.data() as object), id: item.id }) as Contractor;

async function currentProfile(): Promise<AppUser> {
  const { firestore, uid } = requireContext();
  const snapshot = await getDoc(doc(firestore, "users", uid));
  if (!snapshot.exists()) throw new Error("Your user profile could not be loaded.");
  return { ...snapshot.data(), uid } as AppUser;
}

function safeAuditData(value: Partial<Contractor> | Record<string, unknown>) {
  const data = { ...value } as Record<string, unknown>;
  if (typeof data.panNumber === "string") data.panNumber = maskPan(data.panNumber);
  if (typeof data.gstNumber === "string") data.gstNumber = maskGst(data.gstNumber);
  return data;
}

function normalizedInput(input: ContractorInput) {
  return { ...input, legalName: input.legalName.trim(), tradeName: input.tradeName?.trim() || "", registrationNumber: input.registrationNumber?.trim() || "", registrationAuthority: input.registrationAuthority?.trim() || "", contractorClass: input.contractorClass?.trim() || "", gstNumber: normalizeGst(input.gstNumber || ""), panNumber: normalizePan(input.panNumber || ""), contactPersonName: input.contactPersonName.trim(), designation: input.designation?.trim() || "", mobile: normalizeMobile(input.mobile), alternateMobile: normalizeMobile(input.alternateMobile || ""), email: input.email?.trim().toLowerCase() || "", addressLine1: input.addressLine1.trim(), addressLine2: input.addressLine2?.trim() || "", state: input.state.trim(), pinCode: input.pinCode?.trim() || "", remarks: input.remarks?.trim() || "" };
}

export async function getContractors() {
  const { firestore } = requireContext();
  return (await getDocs(collection(firestore, "contractors"))).docs.map(mapContractor).sort((a, b) => a.contractorCode.localeCompare(b.contractorCode));
}
export async function getContractorById(id: string) {
  const { firestore } = requireContext();
  const snapshot = await getDoc(doc(firestore, "contractors", id));
  return snapshot.exists() ? mapContractor(snapshot) : null;
}

export async function checkContractorDuplicates(input: ContractorInput, excludedId?: string) {
  const contractors = await getContractors(), data = normalizedInput(input);
  const others = contractors.filter((item) => item.id !== excludedId);
  const strongDuplicate = others.some((item) => (data.panNumber && normalizePan(item.panNumber || "") === data.panNumber) || (data.gstNumber && normalizeGst(item.gstNumber || "") === data.gstNumber) || (data.registrationNumber && data.registrationAuthority && item.registrationNumber?.trim().toLowerCase() === data.registrationNumber.toLowerCase() && item.registrationAuthority?.trim().toLowerCase() === data.registrationAuthority.toLowerCase()));
  const possibleDuplicate = others.some((item) => item.legalName.trim().toLowerCase() === data.legalName.toLowerCase() && normalizeMobile(item.mobile) === data.mobile);
  return { strongDuplicate, possibleDuplicate };
}

export async function createContractor(input: ContractorInput) {
  const { firestore, uid } = requireContext();
  const profile = await currentProfile();
  const role = profile.systemRole || profile.role;
  if (role !== "scert_admin" && !(role === "agency_user" && profile.assignmentStatus === "assigned" && profile.active === true && profile.approvalStatus === "approved" && profile.primaryAgencyId)) throw new Error("You do not have permission to create contractors.");
  const duplicate = await checkContractorDuplicates(input);
  if (duplicate.strongDuplicate) throw new Error("A contractor with this tax identifier already exists.");
  const existingCodes = await getContractors();
  const highestExistingNumber = existingCodes.reduce((highest, item) => Math.max(highest, Number(item.contractorCode.match(/^CTR-(\d+)$/)?.[1] || 0)), 0);
  const data = normalizedInput(input), contractorRef = doc(collection(firestore, "contractors")), counterRef = doc(firestore, "systemCounters", "contractors"), auditRef = doc(collection(firestore, "auditLogs"));
  await runTransaction(firestore, async (transaction) => {
    const counter = await transaction.get(counterRef), next = counter.exists() ? Number(counter.data().nextNumber || 1) : highestExistingNumber + 1;
    const record = { id: contractorRef.id, contractorCode: `CTR-${String(next).padStart(5, "0")}`, ...data, blacklisted: false, blacklistReason: "", blacklistDate: "", sourceAgencyId: role === "agency_user" ? profile.primaryAgencyId : "", sourceAgencyName: role === "agency_user" ? profile.organisationName || "" : "", createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() };
    transaction.set(counterRef, { nextNumber: next + 1, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(contractorRef, record);
    transaction.set(auditRef, { entityType: "contractor", entityId: contractorRef.id, action: "contractor_created", performedBy: uid, performedAt: serverTimestamp(), previousData: null, newData: safeAuditData(record), remarks: data.remarks });
  });
  return { id: contractorRef.id, possibleDuplicate: duplicate.possibleDuplicate };
}

export async function updateContractor(id: string, input: ContractorInput) {
  const { firestore, uid } = requireContext(); const profile = await currentProfile(); const ref = doc(firestore, "contractors", id); const previous = await getDoc(ref);
  if (!previous.exists()) throw new Error("Contractor not found.");
  const contractor = mapContractor(previous), role = profile.systemRole || profile.role;
  if (role !== "scert_admin" && !(role === "agency_user" && contractor.sourceAgencyId && (profile.assignedAgencyIds || []).includes(contractor.sourceAgencyId))) throw new Error("You do not have permission to edit this contractor.");
  const duplicate = await checkContractorDuplicates(input, id); if (duplicate.strongDuplicate) throw new Error("A contractor with this tax identifier already exists.");
  const data = normalizedInput(input), next = { ...data, updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore); batch.update(ref, next); batch.set(doc(collection(firestore, "auditLogs")), { entityType: "contractor", entityId: id, action: "contractor_updated", performedBy: uid, performedAt: serverTimestamp(), previousData: safeAuditData(contractor), newData: safeAuditData(next), remarks: data.remarks }); await batch.commit();
  return duplicate;
}

async function adminAction(id: string, action: string, changes: Record<string, unknown>, remarks: string) {
  const { firestore, uid } = requireContext(); const profile = await currentProfile(); if ((profile.systemRole || profile.role) !== "scert_admin") throw new Error("Only SCERT Admin can perform this action.");
  const ref = doc(firestore, "contractors", id), previous = await getDoc(ref); if (!previous.exists()) throw new Error("Contractor not found.");
  const next = { ...changes, updatedBy: uid, updatedAt: serverTimestamp() }, batch = writeBatch(firestore); batch.update(ref, next); batch.set(doc(collection(firestore, "auditLogs")), { entityType: "contractor", entityId: id, action, performedBy: uid, performedAt: serverTimestamp(), previousData: safeAuditData(previous.data()), newData: safeAuditData(next), remarks: remarks.trim() }); await batch.commit();
}
export const deactivateContractor = (id: string, reason: string) => adminAction(id, "contractor_deactivated", { active: false }, reason);
export const reactivateContractor = (id: string, remarks: string) => adminAction(id, "contractor_reactivated", { active: true }, remarks);
export const blacklistContractor = (id: string, reason: string, date: string, remarks: string) => adminAction(id, "contractor_blacklisted", { blacklisted: true, blacklistReason: reason.trim(), blacklistDate: date }, remarks);
export const removeContractorBlacklist = (id: string, remarks: string, actionDate: string) => adminAction(id, "contractor_blacklist_removed", { blacklisted: false, blacklistReason: "", blacklistDate: "", blacklistRemovedDate: actionDate }, remarks);
