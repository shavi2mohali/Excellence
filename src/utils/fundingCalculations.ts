import type { FundingShare, WorkPackage } from "../types";

function moneyRound(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFundingShare(amount: number): FundingShare {
  const totalAmount = moneyRound(Number.isFinite(amount) && amount > 0 ? amount : 0);
  const centralShare = moneyRound(totalAmount * 0.6);
  return { totalAmount, centralShare, stateShare: moneyRound(totalAmount - centralShare) };
}

export function getPackageFinancialBasis(workPackage: Pick<WorkPackage, "estimatedCost" | "administrativeApprovalAmount" | "technicalSanctionAmount">) {
  if (workPackage.technicalSanctionAmount > 0) return workPackage.technicalSanctionAmount;
  if (workPackage.administrativeApprovalAmount > 0) return workPackage.administrativeApprovalAmount;
  return Math.max(0, workPackage.estimatedCost || 0);
}
