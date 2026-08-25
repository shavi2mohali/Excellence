import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage } from "../lib/firebase";
import { calculateFundingShare, getPackageFinancialBasis } from "../utils/fundingCalculations";
import type { DietAgencyAssignment, ScopeOfWork, WorkCategory, WorkPackage } from "../types";

export type WorkPackageInput = {
  assignment: DietAgencyAssignment;
  scope?: ScopeOfWork;
  packageTitle: string;
  packageDescription: string;
  workCategory: WorkCategory;
  activityIds: string[];
  estimatedCost: number;
  administrativeApprovalAmount?: number;
  technicalSanctionAmount?: number;
  remarks?: string;
};

function context() {
  if (!db) throw new Error(getFirebaseConfigurationMessage());
  if (!auth?.currentUser) throw new Error("You must be signed in.");
  return { firestore: db, uid: auth.currentUser.uid };
}

const mapPackage = (snapshot: { id: string; data(): unknown }) => ({ id: snapshot.id, ...(snapshot.data() as object) }) as WorkPackage;
const codePart = (value: string) => value.replace(/^DIET\s+/i, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

export async function getWorkPackages() {
  const { firestore } = context();
  return (await getDocs(collection(firestore, "workPackages"))).docs.map(mapPackage);
}
export async function getWorkPackage(id: string) {
  const { firestore } = context();
  const snapshot = await getDoc(doc(firestore, "workPackages", id));
  return snapshot.exists() ? mapPackage(snapshot) : null;
}
export async function getWorkPackagesForDiet(dietId: string) {
  const { firestore } = context();
  return (await getDocs(query(collection(firestore, "workPackages"), where("dietId", "==", dietId)))).docs.map(mapPackage);
}
export async function getWorkPackagesForAgency(agencyId: string) {
  const { firestore } = context();
  return (await getDocs(query(collection(firestore, "workPackages"), where("executingAgencyId", "==", agencyId)))).docs.map(mapPackage);
}

function validate(input: WorkPackageInput) {
  if (input.assignment.status !== "active") throw new Error("Work packages can only be created under an active assignment.");
  if (input.scope && (input.scope.dietId !== input.assignment.dietId || input.scope.executingAgencyId !== input.assignment.executingAgencyId)) throw new Error("The selected scope does not belong to this DIET and executing agency.");
  if (input.scope && input.activityIds.some((id) => !input.scope?.activityIds.includes(id))) throw new Error("Work package activities must belong to the selected scope.");
  if (!input.packageTitle.trim() || !input.packageDescription.trim() || !input.workCategory) throw new Error("Title, description, and category are required.");
  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost <= 0) throw new Error("Estimated cost must be greater than zero.");
  if (new Set(input.activityIds).size !== input.activityIds.length) throw new Error("An activity cannot be selected more than once.");
}

function packageData(input: WorkPackageInput) {
  const estimatedCost = Number(input.estimatedCost);
  const administrativeApprovalAmount = Number(input.administrativeApprovalAmount || 0);
  const technicalSanctionAmount = Number(input.technicalSanctionAmount || 0);
  const basis = getPackageFinancialBasis({ estimatedCost, administrativeApprovalAmount, technicalSanctionAmount });
  const shares = calculateFundingShare(basis);
  return {
    packageTitle: input.packageTitle.trim(), packageDescription: input.packageDescription.trim(),
    dietId: input.assignment.dietId, dietName: input.assignment.dietName, districtId: input.assignment.districtId || "",
    districtName: input.assignment.districtName || "", phaseId: input.assignment.phaseId || "", phaseName: input.assignment.phaseName || "",
    dietAgencyAssignmentId: input.assignment.id, executingAgencyId: input.assignment.executingAgencyId,
    scopeOfWorkId: input.scope?.id || "", scopeOfWorkTitle: input.scope?.scopeTitle || "",
    executingAgencyName: input.assignment.executingAgencyName, executingAgencyType: input.assignment.executingAgencyType || "",
    workCategory: input.workCategory, activityIds: [...new Set(input.activityIds)], estimatedCost,
    administrativeApprovalAmount, technicalSanctionAmount, fundingPattern: "60:40", centralSharePercent: 60,
    stateSharePercent: 40, centralShareAmount: shares.centralShare, stateShareAmount: shares.stateShare,
    remarks: input.remarks?.trim() || "",
  };
}

export async function createWorkPackage(input: WorkPackageInput) {
  if (!input.scope) throw new Error("Select a Scope of Work before creating a work package.");
  validate(input);
  const { firestore, uid } = context();
  const packageRef = doc(collection(firestore, "workPackages"));
  const counterRef = doc(firestore, "packageCounters", input.assignment.dietId);
  const auditRef = doc(collection(firestore, "auditLogs"));
  const data = packageData(input);
  await runTransaction(firestore, async (transaction) => {
    const counter = await transaction.get(counterRef);
    const next = Number(counter.data()?.nextNumber || 1);
    const phase = codePart(input.assignment.phaseName || input.assignment.phaseId || "PHASE").replace(/^PHASE-?/, "");
    const packageCode = `COE/${phase}/${codePart(input.assignment.dietName)}/${String(next).padStart(3, "0")}`;
    const record = { id: packageRef.id, packageCode, ...data, status: "draft", createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() };
    transaction.set(counterRef, { nextNumber: next + 1, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(packageRef, record);
    transaction.set(auditRef, { entityType: "workPackage", entityId: packageRef.id, action: "work_package_created", performedBy: uid, performedAt: serverTimestamp(), previousData: null, newData: record, remarks: data.remarks });
  });
  return packageRef.id;
}

export async function updateWorkPackage(id: string, input: WorkPackageInput) {
  validate(input);
  const { firestore, uid } = context();
  const ref = doc(firestore, "workPackages", id);
  const previous = await getDoc(ref);
  if (!previous.exists()) throw new Error("Work package not found.");
  const data = { ...packageData(input), updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(ref, data);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "workPackage", entityId: id, action: "work_package_updated", performedBy: uid, performedAt: serverTimestamp(), previousData: previous.data(), newData: data, remarks: data.remarks });
  await batch.commit();
}

export async function submitWorkPackageForReview(id: string) {
  const item = await getWorkPackage(id);
  if (!item?.scopeOfWorkId) throw new Error("Select an approved Scope of Work before submitting this package.");
  const { firestore } = context();
  const scope = await getDoc(doc(firestore, "scopeOfWorks", item.scopeOfWorkId));
  if (!scope.exists() || scope.data().status !== "approved") throw new Error("The linked Scope of Work must be approved before package submission.");
  await transition(id, ["draft", "revision_required"], "submitted", "work_package_submitted");
}

export async function reviewWorkPackage(id: string) { await transition(id, ["submitted"], "under_review", "work_package_review_started"); }
export async function returnWorkPackageForRevision(id: string) { await transition(id, ["submitted", "under_review"], "revision_required", "package_returned_for_revision"); }

export async function approveWorkPackageForTender(id: string) {
  const { firestore } = context();
  const target = await getDoc(doc(firestore, "workPackages", id));
  if (!target.exists()) throw new Error("Work package not found.");
  const item = mapPackage(target);
  if (!item.scopeOfWorkId) throw new Error("Link this legacy package to an approved Scope of Work before approval.");
  const scope = await getDoc(doc(firestore, "scopeOfWorks", item.scopeOfWorkId));
  if (!scope.exists() || scope.data().status !== "approved") throw new Error("The linked Scope of Work must be approved first.");
  const packages = await getWorkPackagesForDiet(item.dietId);
  const duplicate = packages.some((other) => other.id !== id && !["cancelled", "completed"].includes(other.status) && other.activityIds?.some((activityId) => item.activityIds.includes(activityId)));
  if (duplicate) throw new Error("This activity is already included in another active work package for this DIET.");
  await transition(id, ["under_review"], "approved_for_tender", "approved_for_tender");
}

async function transition(id: string, expected: string[], status: string, action: string) {
  const { firestore, uid } = context();
  const ref = doc(firestore, "workPackages", id);
  const previous = await getDoc(ref);
  if (!previous.exists() || !expected.includes(previous.data().status)) throw new Error("Work package is not in the required status for this action.");
  const next = { status, updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  batch.update(ref, next);
  batch.set(doc(collection(firestore, "auditLogs")), { entityType: "workPackage", entityId: id, action, performedBy: uid, performedAt: serverTimestamp(), previousData: previous.data(), newData: next, remarks: "" });
  await batch.commit();
}
