export type UserRole =
  | "pending_user"
  | "scert_admin"
  | "scert_viewer"
  | "diet_nodal_officer"
  | "agency_user"
  | "finance_officer"
  | "monitoring_officer";

export type SystemRole = UserRole;

export type OrganisationRole = "diet" | "pwd" | "rdp";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export type AssignmentStatus = "unassigned" | "assigned" | "inactive";
export type AssignmentType = "diet_assignment" | "agency_assignment" | "reassignment" | "deactivation";

export type DietStatus = "planning" | "in_progress" | "completed" | "delayed";

export type AppUser = {
  uid: string;
  name?: string;
  displayName?: string;
  email: string;
  role?: UserRole;
  systemRole?: SystemRole;
  mobile?: string;
  designation?: string;
  organisationRole?: OrganisationRole;
  organisationRoleLabel?: string;
  organisationName?: string;
  districtId?: string;
  districtName?: string;
  officeAddress?: string;
  officeTelephone?: string;
  divisionName?: string;
  officialWebsite?: string;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: unknown;
  rejectedBy?: string | null;
  rejectedAt?: unknown;
  rejectionReason?: string;
  active?: boolean;
  assignedDietIds?: string[];
  assignedAgencyIds?: string[];
  primaryDietId?: string | null;
  primaryAgencyId?: string | null;
  assignmentStatus?: AssignmentStatus;
  assignedBy?: string | null;
  assignedAt?: unknown;
  assignmentRemarks?: string;
  isActive?: boolean;
  approved?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UserProfile = AppUser;

export type AccessScope = {
  accessType: "global" | "diet" | "agency" | "none";
  dietIds: string[] | null;
  agencyIds: string[] | null;
  districtIds: string[] | null;
};

export type UserAssignment = {
  id: string;
  userId: string;
  userEmail: string;
  organisationRole: OrganisationRole;
  systemRole: SystemRole;
  assignmentType: AssignmentType;
  dietId: string | null;
  dietName: string | null;
  agencyId: string | null;
  agencyName: string | null;
  previousDietId: string | null;
  previousAgencyId: string | null;
  status: AssignmentStatus;
  remarks: string;
  assignedBy: string;
  assignedAt?: unknown;
  endedBy?: string | null;
  endedAt?: unknown;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RegistrationRequest = {
  userId: string;
  email: string;
  organisationRole: OrganisationRole;
  organisationRoleLabel: string;
  organisationName: string;
  districtId: string;
  districtName: string;
  contactPersonName: string;
  designation: string;
  mobile: string;
  officeAddress: string;
  requestedSystemRole: SystemRole;
  status: ApprovalStatus;
  submittedAt?: unknown;
  reviewedBy?: string | null;
  reviewedAt?: unknown;
  reviewRemarks?: string;
};

export type Phase = {
  id: string;
  name: string;
  year: string;
  order: number;
  active: boolean;
};

export type Diet = {
  id: string;
  name: string;
  shortName?: string;
  district: string;
  districtId?: string;
  districtName?: string;
  location?: string;
  active?: boolean;
  phaseId: string;
  phaseName?: string;
  phaseYear: string;
  status: DietStatus;
  projectStatus?: DietStatus;
  totalApprovedCost: number;
  centralShare: number;
  stateShare: number;
  fundsReleased: number;
  expenditure: number;
  physicalProgressPercent: number;
  physicalProgress?: number;
  financialProgressPercent: number;
  assignedAgencyId: string;
  nodalOfficerName: string;
  nodalOfficerMobile: string;
  nodalOfficerEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ActivityMaster = {
  id: string;
  serialNo: number;
  activityHead: string;
  subActivity: string;
  code: string;
  active: boolean;
  scopeCategories?: ScopeCategory[];
  workCategories?: WorkCategory[];
};

export type ScopeCategory =
  | "civil_work" | "electrical_work" | "water_supply" | "sanitation" | "furniture"
  | "ict" | "laboratory_equipment" | "library_resources" | "procurement"
  | "campus_development" | "other";

export type DietAgencyAssignmentStatus = "draft" | "active" | "completed" | "cancelled" | "superseded";

export type DietAgencyAssignment = {
  id: string;
  dietId: string;
  dietName: string;
  phaseId: string;
  phaseName: string;
  executingAgencyId: string;
  executingAgencyName: string;
  executingAgencyType: string;
  districtId: string;
  districtName: string;
  scopeCategories?: ScopeCategory[];
  assignmentOrderNumber: string;
  assignmentOrderDate: string;
  scopeSummary?: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: DietAgencyAssignmentStatus;
  remarks: string;
  supersedesAssignmentId?: string;
  supersededByAssignmentId?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedBy: string;
  updatedAt?: unknown;
};

export type WorkCategory =
  | "civil_work" | "electrical_work" | "procurement" | "furniture" | "ict"
  | "laboratory" | "library" | "campus_development" | "mixed" | "other";

export type WorkPackageStatus =
  | "draft" | "submitted" | "under_review" | "revision_required" | "approved_for_tender" | "tender_in_progress"
  | "awarded" | "work_in_progress" | "completed" | "cancelled";

export type FundingShare = {
  totalAmount: number;
  centralShare: number;
  stateShare: number;
};

export type WorkPackage = {
  id: string;
  packageCode: string;
  packageTitle: string;
  packageDescription: string;
  dietId: string;
  dietName: string;
  districtId: string;
  districtName: string;
  phaseId: string;
  phaseName: string;
  dietAgencyAssignmentId: string;
  scopeOfWorkId?: string;
  scopeOfWorkTitle?: string;
  executingAgencyId: string;
  executingAgencyName: string;
  executingAgencyType: string;
  workCategory: WorkCategory;
  activityIds: string[];
  estimatedCost: number;
  administrativeApprovalAmount: number;
  technicalSanctionAmount: number;
  fundingPattern: "60:40";
  centralSharePercent: 60;
  stateSharePercent: 40;
  centralShareAmount: number;
  stateShareAmount: number;
  status: WorkPackageStatus;
  remarks: string;
  createdBy: string;
  createdAt?: unknown;
  updatedBy: string;
  updatedAt?: unknown;
  contractorId?: string;
  contractorName?: string;
  tenderAwardId?: string;
  finalContractValue?: number;
  workOrderId?: string;
  workOrderNumber?: string;
  workOrderStatus?: WorkOrderStatus;
};

export type TenderType = "open_tender" | "limited_tender" | "e_tender" | "quotation" | "single_tender" | "other";
export type ProcurementMethod = "single_stage" | "two_bid_system" | "two_stage" | "rate_contract" | "quotation" | "other";
export type TenderStatus = "draft" | "submitted_for_review" | "revision_required" | "approved_for_publication" | "published" | "bid_submission_open" | "bid_submission_closed" | "technical_bid_due" | "cancelled" | "retender_required";

export interface Tender {
  id: string;
  tenderNumber: string;
  tenderTitle: string;
  nitNumber?: string;
  workPackageId: string;
  workPackageCode: string;
  workPackageTitle: string;
  scopeOfWorkId?: string;
  dietId: string;
  dietName: string;
  districtId?: string;
  districtName?: string;
  phaseId: string;
  phaseName: string;
  dietAgencyAssignmentId: string;
  executingAgencyId: string;
  executingAgencyName: string;
  executingAgencyType: string;
  tenderType: TenderType;
  procurementMethod: ProcurementMethod;
  sourceFinancialBasis: number;
  estimatedTenderValue: number;
  valueVariationAmount: number;
  valueVariationPercent: number;
  valueVariationRemarks?: string;
  emdAmount?: number;
  tenderFee?: number;
  noticeDate?: unknown;
  publicationDate?: unknown;
  documentDownloadStartDate?: unknown;
  bidSubmissionStartDate?: unknown;
  bidSubmissionEndDate?: unknown;
  preBidMeetingDate?: unknown;
  technicalBidOpeningDate?: unknown;
  financialBidOpeningDate?: unknown;
  bidValidityDays?: number;
  completionPeriodValue?: number;
  completionPeriodUnit?: "days" | "months";
  tenderPortalName?: string;
  tenderPortalReference?: string;
  tenderPortalUrl?: string;
  status: TenderStatus;
  publicationRemarks?: string;
  internalRemarks?: string;
  revisionRemarks?: string;
  revisionRequestedBy?: string;
  revisionRequestedAt?: unknown;
  createdBy: string;
  createdAt?: unknown;
  updatedBy: string;
  updatedAt?: unknown;
  submittedBy?: string;
  submittedAt?: unknown;
  reviewedBy?: string;
  reviewedAt?: unknown;
  approvedForPublicationBy?: string;
  approvedForPublicationAt?: unknown;
  scertReviewRemarks?: string;
  publishedBy?: string;
  publishedAt?: unknown;
  cancelledBy?: string;
  cancelledAt?: unknown;
  cancellationReason?: string;
  technicalEvaluationStatus?: "not_started" | "in_progress" | "submitted_for_review" | "revision_required" | "approved";
  financialEvaluationStatus?: FinancialEvaluationStatus;
  financialBidsOpenedBy?: string;
  financialBidsOpenedAt?: unknown;
  financialBidOpeningRemarks?: string;
  financialEvaluationApprovedBy?: string;
  financialEvaluationApprovedAt?: unknown;
  financialEvaluationRevisionRemarks?: string;
  financialTieAcknowledged?: boolean;
  awardStatus?: "not_started" | "recommendation_pending" | "recommendation_approved" | "awarded" | "cancelled";
  selectedContractorId?: string;
  selectedContractorName?: string;
  tenderAwardId?: string;
}

export type FinancialBidStatus = "not_opened" | "opened" | "entered" | "under_comparison" | "submitted_for_review" | "revision_required" | "approved";
export type FinancialEvaluationStatus = "not_started" | "in_progress" | "submitted_for_review" | "revision_required" | "approved";

export interface TenderBid {
  id: string;
  tenderId: string;
  contractorId: string;
  contractorCode: string;
  contractorName: string;
  qualified?: boolean;
  withdrawn?: boolean;
  status?: string;
  technicalEvaluationStatus?: string;
  technicalRemarks?: string;
  disqualificationReason?: string;
}

export interface TenderFinancialBid {
  id: string; tenderId: string; tenderNumber: string; tenderBidId: string; contractorId: string; contractorCode: string; contractorName: string;
  workPackageId: string; dietId: string; dietName: string; executingAgencyId: string; executingAgencyName: string; tenderEstimatedValue: number;
  quotedAmount: number; negotiatedAmount?: number; finalEvaluatedAmount: number; amountDifferenceFromEstimate: number; percentAboveBelowEstimate: number;
  comparisonPosition?: number; rank?: number; isL1: boolean; isL2: boolean; isL3: boolean; isJointLowest?: boolean;
  isSelectedForRecommendation: boolean; financialBidStatus: FinancialBidStatus; remarks?: string;
  enteredBy: string; enteredAt?: unknown; updatedBy: string; updatedAt?: unknown;
}

export type AwardRecommendationStatus = "draft" | "submitted_to_scert" | "revision_required" | "approved" | "rejected";
export interface TenderAwardRecommendation {
  id:string; tenderId:string; tenderNumber:string; workPackageId:string; dietId:string; dietName:string; executingAgencyId:string; executingAgencyName:string;
  recommendedTenderBidId:string; recommendedFinancialBidId:string; contractorId:string; contractorCode:string; contractorName:string; financialRank:number|null; isL1:boolean;
  tenderEstimatedValue:number; quotedAmount:number; evaluatedAmount:number; proposedAwardAmount:number; recommendationReason:string; nonL1Justification?:string; jointL1Justification?:string;
  status:AwardRecommendationStatus; recommendedBy:string; recommendedAt?:unknown; updatedBy:string; updatedAt?:unknown; reviewedBy?:string; reviewedAt?:unknown; scertRemarks?:string;
}
export type TenderAwardStatus = "draft" | "approved" | "award_letter_issued" | "work_order_pending" | "work_order_issued" | "cancelled";
export interface TenderAward {
  id:string; tenderId:string; tenderNumber:string; workPackageId:string; workPackageCode:string; workPackageTitle:string; dietId:string; dietName:string; executingAgencyId:string; executingAgencyName:string;
  contractorId:string; contractorCode:string; contractorName:string; selectedTenderBidId:string; selectedFinancialBidId:string; recommendationId:string; financialRank:number|null; isL1:boolean;
  tenderEstimatedValue:number; quotedAmount:number; evaluatedAmount:number; acceptedTenderAmount:number; negotiationAmount?:number; finalContractValue:number;
  amountDifferenceFromTenderEstimate:number; percentDifferenceFromTenderEstimate:number; tenderSavingAmount:number; tenderSavingPercent:number; excessOverTenderEstimateAmount:number; excessOverTenderEstimatePercent:number;
  contractCentralShare:number; contractStateShare:number; awardNumber:string; awardDate:unknown; status:TenderAwardStatus; approvedBy:string; approvedAt?:unknown; createdBy:string; createdAt?:unknown; updatedBy:string; updatedAt?:unknown; remarks?:string;
}
export type WorkOrderStatus = "draft" | "issued" | "acknowledged" | "work_not_started" | "work_started" | "completed" | "terminated" | "cancelled";
export interface WorkOrder {
  id:string; workOrderNumber:string; workOrderDate:unknown; tenderAwardId:string; tenderId:string; workPackageId:string; dietId:string; dietName:string; executingAgencyId:string; executingAgencyName:string;
  contractorId:string; contractorCode:string; contractorName:string; contractValue:number; commencementDate?:unknown; completionPeriodValue:number; completionPeriodUnit:"days"|"months"; scheduledCompletionDate?:unknown;
  performanceSecurityAmount?:number; performanceSecurityPercent?:number; securityDepositPercent?:number; retentionPercent?:number; agreementNumber?:string; agreementDate?:unknown; status:WorkOrderStatus;
  issuedBy:string; issuedAt?:unknown; createdBy:string; createdAt?:unknown; updatedBy:string; updatedAt?:unknown; remarks?:string;
}

export type ScopeOfWorkStatus = "draft" | "submitted" | "under_review" | "approved" | "revision_required" | "cancelled";
export type ScopeOfWork = {
  id: string; dietId: string; dietName: string; phaseId: string; phaseName: string;
  dietAgencyAssignmentId: string; executingAgencyId: string; executingAgencyName: string;
  scopeTitle: string; scopeDescription: string; scopeCategories: ScopeCategory[]; activityIds: string[];
  status: ScopeOfWorkStatus; preparedBy: string; preparedAt?: unknown; updatedBy: string; updatedAt?: unknown;
  reviewedBy?: string; reviewedAt?: unknown; approvedBy?: string; approvedAt?: unknown; remarks: string;
};

export type AgencyType =
  | "PWD"
  | "Punjab Mandi Board"
  | "Rural Development and Panchayat Department"
  | "Private Contractor"
  | "PSIEC"
  | "Other";

export interface Agency {
  id: string;
  name: string;
  type: AgencyType;
  agencyCategory?: "executing_agency" | "private_contractor";
  agencyType?: "pwd" | "rdp" | "punjab_mandi_board" | "psiec" | "other_government_agency";
  districtId?: string;
  districtName?: string;
  divisionName?: string;
  contactPersonName?: string;
  contactPersonMobile?: string;
  contactPersonEmail?: string;
  address?: string;
  active: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ContractorEntityType = "proprietorship" | "partnership" | "private_limited" | "public_limited" | "llp" | "cooperative" | "society" | "other";
export type ContractorCategory = "civil_contractor" | "electrical_contractor" | "plumbing_contractor" | "water_supply_contractor" | "sanitation_contractor" | "furniture_supplier" | "ict_supplier" | "laboratory_supplier" | "library_supplier" | "equipment_supplier" | "general_supplier" | "other";

export interface Contractor {
  id: string;
  contractorCode: string;
  legalName: string;
  tradeName?: string;
  entityType: ContractorEntityType;
  contractorCategories: ContractorCategory[];
  registrationNumber?: string;
  registrationAuthority?: string;
  contractorClass?: string;
  gstNumber?: string;
  panNumber?: string;
  contactPersonName: string;
  designation?: string;
  mobile: string;
  alternateMobile?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  districtId?: string;
  districtName?: string;
  state: string;
  pinCode?: string;
  active: boolean;
  blacklisted: boolean;
  blacklistReason?: string;
  blacklistDate?: string;
  remarks?: string;
  sourceAgencyId?: string;
  sourceAgencyName?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedBy: string;
  updatedAt?: unknown;
}
