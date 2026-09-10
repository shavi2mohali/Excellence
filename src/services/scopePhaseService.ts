import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getPhaseSequence, requiresPrePabWorkflow } from "../constants/projectPhases";
import type { Diet, Phase } from "../types";

// Resolve the master DIET, never trust phase fields supplied on a Scope or form.
export async function getScopeDietPhase(dietId: string): Promise<number> {
  if (!db) throw new Error("Firebase is not configured.");
  const snapshot = await getDoc(doc(db, "diets", dietId));
  if (!snapshot.exists()) return 0;
  const diet = snapshot.data() as Diet;
  const sequence = getPhaseSequence(diet);
  if (sequence || !diet.phaseId) return sequence;
  const phase = await getDoc(doc(db, "phases", diet.phaseId));
  return phase.exists() ? getPhaseSequence({ ...phase.data() as Phase, id: diet.phaseId }) : 0;
}

export async function assertScopePhase(dietId: string) {
  if (!requiresPrePabWorkflow(await getScopeDietPhase(dietId))) {
    throw new Error("Scope of Work is available only for Phase III onward DIETs. Verify the project phase.");
  }
}

export async function filterScopeProjects<T extends { dietId: string }>(records: T[]): Promise<T[]> {
  const ids = [...new Set(records.map(record => record.dietId))];
  const enabled = new Set((await Promise.all(ids.map(async id => requiresPrePabWorkflow(await getScopeDietPhase(id)) ? id : null))).filter(Boolean));
  return records.filter(record => enabled.has(record.dietId));
}
