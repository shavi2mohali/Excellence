import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getAccessibleDiets } from "../services/accessScopeService";
import { getScopeDietPhase } from "../services/scopePhaseService";
import { requiresPrePabWorkflow } from "../constants/projectPhases";
import type { Diet } from "../types";

type ScopePhaseState = { diets: Diet[]; loading: boolean; error: string; contextDietId: string; eligibleDietIds: string[]; showNavigation: boolean };
const Context = createContext<ScopePhaseState>({ diets: [], loading: true, error: "", contextDietId: "", eligibleDietIds: [], showNavigation: false });
export function ScopePhaseProvider({ children }: { children: ReactNode }) {
  const { accessScope } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<{ owner: typeof accessScope; diets: Diet[]; loading: boolean; error: string }>({ owner: null, diets: [], loading: true, error: "" });
  useEffect(() => {
    let cancelled = false;
    if (!accessScope) return;
    setState({ owner: accessScope, diets: [], loading: true, error: "" });
    getAccessibleDiets(accessScope).then(diets => Promise.all(diets.map(async diet => ({ ...diet, phaseSequence: await getScopeDietPhase(diet.id) })))).then(diets => {
      if (!cancelled) setState({ owner: accessScope, diets, loading: false, error: "" });
    }).catch(error => { if (!cancelled) setState({ owner: accessScope, diets: [], loading: false, error: error instanceof Error ? error.message : "Unable to verify project phases." }); });
    return () => { cancelled = true; };
  }, [accessScope]);
  const loading = state.loading || state.owner !== accessScope;
  const diets = loading ? [] : state.diets;
  const contextDietId = matchPath("/diets/:dietId", location.pathname)?.params.dietId || new URLSearchParams(location.search).get("dietId") || "";
  const eligibleDietIds = diets.filter(diet => requiresPrePabWorkflow(diet.phaseSequence || 0)).map(diet => diet.id);
  // Mixed-phase accounts choose a DIET before entering its Scope workflow.
  const showNavigation = !loading && (contextDietId ? eligibleDietIds.includes(contextDietId) : eligibleDietIds.length > 0 && (accessScope?.accessType === "global" || eligibleDietIds.length === diets.length));
  return <Context.Provider value={{ diets, loading, error: state.error, contextDietId, eligibleDietIds, showNavigation }}>{children}</Context.Provider>;
}
export const useScopePhases = () => useContext(Context);
