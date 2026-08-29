import { getDietById, getDiets } from "../lib/firestore";
import type { AccessScope, AppUser, Diet, DietAgencyAssignment, ScopeOfWork, Tender, WorkPackage } from "../types";
import { getAssignmentsForAgency, getAssignmentsForDiet, getDietAgencyAssignments } from "./dietAgencyAssignmentService";
import { getScopeOfWorks, getScopesForAgency, getScopesForDiet } from "./scopeOfWorkService";
import { getTenders, getTendersForAgency, getTendersForDiet } from "./tenderService";
import { getWorkPackages, getWorkPackagesForAgency, getWorkPackagesForDiet } from "./workPackageService";

const globalRoles = new Set(["scert_admin", "scert_viewer", "finance_officer", "monitoring_officer"]);
const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];
const dedupe = <T extends { id: string }>(groups: T[][]) => [...new Map(groups.flat().map((item) => [item.id, item])).values()];

export function assignedDietIds(profile: AppUser) {
  return unique(profile.assignedDietIds?.length ? profile.assignedDietIds : [profile.primaryDietId]);
}

export function assignedAgencyIds(profile: AppUser) {
  return unique(profile.assignedAgencyIds?.length ? profile.assignedAgencyIds : [profile.primaryAgencyId]);
}

export async function getUserAccessScope(profile: AppUser): Promise<AccessScope> {
  const role = profile.systemRole || profile.role;
  if (role && globalRoles.has(role)) return { accessType: "global", dietIds: null, agencyIds: null, districtIds: null };

  if (role === "diet_nodal_officer") {
    const dietIds = assignedDietIds(profile);
    const diets = await Promise.all(dietIds.map(getDietById));
    return { accessType: dietIds.length ? "diet" : "none", dietIds, agencyIds: [], districtIds: unique(diets.map((diet) => diet?.districtId || diet?.district)) };
  }

  if (role === "agency_user") {
    const agencyIds = assignedAgencyIds(profile);
    const assignments = dedupe(await Promise.all(agencyIds.map(getAssignmentsForAgency)));
    const relevant = assignments.filter((item) => !["cancelled", "superseded"].includes(item.status));
    return {
      accessType: agencyIds.length ? "agency" : "none",
      agencyIds,
      dietIds: unique(relevant.map((item) => item.dietId)),
      districtIds: unique(relevant.map((item) => item.districtId)),
    };
  }
  if(role==="architecture_user")return{accessType:"architecture",dietIds:assignedDietIds(profile),agencyIds:[],districtIds:[]};

  return { accessType: "none", dietIds: [], agencyIds: [], districtIds: [] };
}

export function canAccessDiet(scope: AccessScope | null, dietId: string) {
  return scope?.accessType === "global" || Boolean(scope?.dietIds?.includes(dietId));
}
export function canAccessAgency(scope: AccessScope | null, agencyId: string) {
  return scope?.accessType === "global" || Boolean(scope?.agencyIds?.includes(agencyId));
}
export function canAccessExecutionRecord(scope: AccessScope | null, record: { dietId: string; executingAgencyId: string }) {
  return scope?.accessType === "global"
    || (scope?.accessType === "diet" && Boolean(scope.dietIds?.includes(record.dietId)))
    || (scope?.accessType === "agency" && Boolean(scope.agencyIds?.includes(record.executingAgencyId)));
}

export async function getAccessibleDiets(scope: AccessScope): Promise<Diet[]> {
  if (scope.accessType === "global") {
    return getDiets();
  }
  if (scope.accessType === "agency") {
    const assignments = await getAccessibleAssignments(scope);
    return [...new Map(assignments.filter((item) => !["cancelled", "superseded"].includes(item.status)).map((item) => ({
      id: item.dietId, name: item.dietName, district: item.districtName, districtId: item.districtId, districtName: item.districtName,
      phaseId: item.phaseId, phaseName: item.phaseName, phaseYear: item.phaseName, status: "planning", totalApprovedCost: 0,
      centralShare: 0, stateShare: 0, fundsReleased: 0, expenditure: 0, physicalProgressPercent: 0, financialProgressPercent: 0,
      assignedAgencyId: item.executingAgencyId, nodalOfficerName: "", nodalOfficerMobile: "", nodalOfficerEmail: "",
    } as Diet)).map((item) => [item.id, item])).values()];
  }
  return (await Promise.all((scope.dietIds || []).map(getDietById))).filter((item): item is Diet => Boolean(item));
}
export async function getAccessibleAssignments(scope: AccessScope): Promise<DietAgencyAssignment[]> {
  if (scope.accessType === "global") return getDietAgencyAssignments();
  if (scope.accessType === "diet") return dedupe(await Promise.all((scope.dietIds || []).map(getAssignmentsForDiet)));
  if (scope.accessType === "agency") return dedupe(await Promise.all((scope.agencyIds || []).map(getAssignmentsForAgency)));
  return [];
}
export async function getAccessibleScopes(scope: AccessScope): Promise<ScopeOfWork[]> {
  if (scope.accessType === "global") return getScopeOfWorks();
  if (scope.accessType === "diet") return dedupe(await Promise.all((scope.dietIds || []).map(getScopesForDiet)));
  if (scope.accessType === "architecture") return dedupe(await Promise.all((scope.dietIds || []).map(getScopesForDiet)));
  if (scope.accessType === "agency") return dedupe(await Promise.all((scope.agencyIds || []).map(getScopesForAgency)));
  return [];
}
export async function getAccessibleWorkPackages(scope: AccessScope): Promise<WorkPackage[]> {
  if (scope.accessType === "global") return getWorkPackages();
  if (scope.accessType === "diet") return dedupe(await Promise.all((scope.dietIds || []).map(getWorkPackagesForDiet)));
  if (scope.accessType === "agency") return dedupe(await Promise.all((scope.agencyIds || []).map(getWorkPackagesForAgency)));
  return [];
}
export async function getAccessibleTenders(scope: AccessScope): Promise<Tender[]> {
  if (scope.accessType === "global") return getTenders();
  if (scope.accessType === "diet") return dedupe(await Promise.all((scope.dietIds || []).map(getTendersForDiet)));
  if (scope.accessType === "agency") return dedupe(await Promise.all((scope.agencyIds || []).map(getTendersForAgency)));
  return [];
}
