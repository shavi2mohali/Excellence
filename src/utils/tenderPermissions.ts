import type { AppUser, Tender } from "../types";

const role = (profile: AppUser | null) => profile?.systemRole || profile?.role;
export function canTransitionTenderStatus(current: Tender["status"], next: Tender["status"], userRole?: string) {
  const transitions: Partial<Record<Tender["status"], Tender["status"][]>> = userRole === "scert_admin"
    ? { draft: ["published"], submitted_for_review: ["revision_required", "approved_for_publication"], revision_required: ["published"], approved_for_publication: ["published"] }
    : userRole === "agency_user"
      ? { draft: ["published"], revision_required: ["published"], approved_for_publication: ["published"] }
      : {};
  return transitions[current]?.includes(next) === true;
}
export const canCreateTender = (profile: AppUser | null, agencyId: string) => role(profile) === "scert_admin" || (role(profile) === "agency_user" && profile?.approvalStatus === "approved" && profile.active === true && profile.assignmentStatus === "assigned" && (profile.assignedAgencyIds || []).includes(agencyId));
export const canEditTender = (profile: AppUser | null, tender: Tender) => role(profile) === "scert_admin" || (role(profile) === "agency_user" && (profile?.assignedAgencyIds || []).includes(tender.executingAgencyId) && ["draft", "revision_required"].includes(tender.status));
export const canPublishTender = (profile: AppUser | null, tender: Tender) => ["draft", "revision_required", "approved_for_publication"].includes(tender.status) && (role(profile) === "scert_admin" || (role(profile) === "agency_user" && (profile?.assignedAgencyIds || []).includes(tender.executingAgencyId)));
