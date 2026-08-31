import type { CoEPhase } from "../types";

export type PhaseCapabilities = {
  historicalFinancialMode: boolean;
  scopeRequired: boolean;
  architectureRequired: boolean;
  pabWorkflowRequired: boolean;
  directHistoricalApprovedAmountEntryAllowed: boolean;
};

export const canonicalPhases: { id: CoEPhase; label: string; phaseSequence: number }[] = [
  { id: "phase_1", label: "Phase I", phaseSequence: 1 },
  { id: "phase_2", label: "Phase II", phaseSequence: 2 },
  { id: "phase_3", label: "Phase III", phaseSequence: 3 },
];

const legacyPhaseSequence: Record<string, number> = {
  phase_2023_24: 1,
  phase_2025_26: 2,
  phase_2026_27: 3,
};

export function getPhaseSequence(value?: { phaseId?: string; phaseSequence?: number; id?: string; order?: number }) {
  return Number(value?.phaseSequence || 0) || legacyPhaseSequence[value?.phaseId || value?.id || ""] || Number(value?.order || 0) || 0;
}

export function getPhaseCapabilities(phaseSequence: number): PhaseCapabilities {
  const historicalFinancialMode = phaseSequence > 0 && phaseSequence <= 2;
  return {
    historicalFinancialMode,
    scopeRequired: !historicalFinancialMode,
    architectureRequired: !historicalFinancialMode,
    pabWorkflowRequired: !historicalFinancialMode,
    directHistoricalApprovedAmountEntryAllowed: historicalFinancialMode,
  };
}

export const isHistoricalFinancialPhase = (phaseSequence: number) => getPhaseCapabilities(phaseSequence).historicalFinancialMode;
export const requiresPrePabWorkflow = (phaseSequence: number) => getPhaseCapabilities(phaseSequence).pabWorkflowRequired;
