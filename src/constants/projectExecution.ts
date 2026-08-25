import type { DietAgencyAssignmentStatus, ScopeCategory, WorkCategory, WorkPackageStatus } from "../types";

export const scopeCategoryOptions: { value: ScopeCategory; label: string }[] = [
  ["civil_work", "Civil Works"], ["electrical_work", "Electrical Works"], ["water_supply", "Water Supply"],
  ["sanitation", "Sanitation"], ["furniture", "Furniture"], ["ict", "ICT"],
  ["laboratory_equipment", "Laboratory Equipment"], ["library_resources", "Library Resources"],
  ["procurement", "Procurement"], ["campus_development", "Campus Development"], ["other", "Other"],
].map(([value, label]) => ({ value: value as ScopeCategory, label }));

export const workCategoryOptions: { value: WorkCategory; label: string }[] = [
  ["civil_work", "Civil Works"], ["electrical_work", "Electrical Works"], ["procurement", "Procurement"],
  ["furniture", "Furniture"], ["ict", "ICT"], ["laboratory", "Laboratory"], ["library", "Library"],
  ["campus_development", "Campus Development"], ["mixed", "Mixed"], ["other", "Other"],
].map(([value, label]) => ({ value: value as WorkCategory, label }));

export const assignmentStatusLabels: Record<DietAgencyAssignmentStatus, string> = {
  draft: "Draft", active: "Active", completed: "Completed", cancelled: "Cancelled", superseded: "Superseded",
};

export const workPackageStatusLabels: Record<WorkPackageStatus, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under Review", revision_required: "Revision Required", approved_for_tender: "Approved for Tender",
  tender_in_progress: "Tender in Progress", awarded: "Awarded", work_in_progress: "Work in Progress",
  completed: "Completed", cancelled: "Cancelled",
};

export function labelScope(value: ScopeCategory) {
  return scopeCategoryOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

export function labelWorkCategory(value: WorkCategory) {
  return workCategoryOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}
