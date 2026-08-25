import type { ContractorCategory, ContractorEntityType } from "../types";

export const contractorEntityTypeOptions: { value: ContractorEntityType; label: string }[] = [
  ["proprietorship", "Proprietorship"], ["partnership", "Partnership Firm"], ["private_limited", "Private Limited Company"],
  ["public_limited", "Public Limited Company"], ["llp", "Limited Liability Partnership"], ["cooperative", "Cooperative"],
  ["society", "Society"], ["other", "Other"],
].map(([value, label]) => ({ value: value as ContractorEntityType, label }));

export const contractorCategoryOptions: { value: ContractorCategory; label: string }[] = [
  ["civil_contractor", "Civil Contractor"], ["electrical_contractor", "Electrical Contractor"], ["plumbing_contractor", "Plumbing Contractor"],
  ["water_supply_contractor", "Water Supply Contractor"], ["sanitation_contractor", "Sanitation Contractor"], ["furniture_supplier", "Furniture Supplier"],
  ["ict_supplier", "ICT Supplier"], ["laboratory_supplier", "Laboratory Supplier"], ["library_supplier", "Library Supplier"],
  ["equipment_supplier", "Equipment Supplier"], ["general_supplier", "General Supplier"], ["other", "Other"],
].map(([value, label]) => ({ value: value as ContractorCategory, label }));

export const contractorEntityLabel = (value: ContractorEntityType) => contractorEntityTypeOptions.find((item) => item.value === value)?.label || value.replaceAll("_", " ");
export const contractorCategoryLabel = (value: ContractorCategory) => contractorCategoryOptions.find((item) => item.value === value)?.label || value.replaceAll("_", " ");
