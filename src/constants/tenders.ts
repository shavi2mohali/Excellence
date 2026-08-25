import type { ProcurementMethod, TenderStatus, TenderType } from "../types";

export const tenderTypeLabels: Record<TenderType, string> = { open_tender: "Open Tender", limited_tender: "Limited Tender", e_tender: "E-Tender", quotation: "Quotation", single_tender: "Single Tender", other: "Other" };
export const procurementMethodLabels: Record<ProcurementMethod, string> = { single_stage: "Single Stage", two_bid_system: "Two-Bid System", two_stage: "Two-Stage Tender", rate_contract: "Rate Contract", quotation: "Quotation", other: "Other" };
export const tenderStatusLabels: Record<TenderStatus, string> = { draft: "Draft", submitted_for_review: "Submitted to SCERT", revision_required: "Revision Required", approved_for_publication: "Approved for Publication", published: "Published", bid_submission_open: "Bid Submission Open", bid_submission_closed: "Bid Submission Closed", technical_bid_due: "Technical Bid Due", cancelled: "Cancelled", retender_required: "Re-tender Required" };

export function getTenderOperationalStatus(tender: { status: TenderStatus; bidSubmissionStartDate?: unknown; bidSubmissionEndDate?: unknown }, now = new Date()) {
  if (tender.status !== "published") return tender.status;
  const date = (value: unknown) => value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : value ? new Date(String(value)) : null;
  const start = date(tender.bidSubmissionStartDate), end = date(tender.bidSubmissionEndDate);
  if (end && now > end) return "bid_submission_closed" as const;
  if (!start || now >= start) return "bid_submission_open" as const;
  return tender.status;
}

export function isTenderClosingSoon(tender: { bidSubmissionEndDate?: unknown }, now = new Date(), days = 3) {
  const value = tender.bidSubmissionEndDate;
  const end = value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : value ? new Date(String(value)) : null;
  return Boolean(end && end >= now && end.getTime() - now.getTime() <= days * 86400000);
}
