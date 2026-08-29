import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DietActivityFinancialSummary } from "../components/DietActivityFinancialSummary";
import { useAuth } from "../contexts/AuthContext";
import { getPhases } from "../lib/firestore";
import { canAccessDiet, getAccessibleDiets } from "../services/accessScopeService";
import { getAgencies } from "../services/agencyService";
import { activateDietAgencyAssignment, cancelDietAgencyAssignment, createDietAgencyAssignment, getAssignmentsForDiet, supersedeDietAgencyAssignment, updateDietAgencyAssignment } from "../services/dietAgencyAssignmentService";
import { getWorkPackagesForDiet } from "../services/workPackageService";
import { getScopesForDiet } from "../services/scopeOfWorkService";
import { assignmentStatusLabels, labelWorkCategory, workPackageStatusLabels } from "../constants/projectExecution";
import { formatIndianCurrency } from "../utils/currency";
import { getPackageFinancialBasis } from "../utils/fundingCalculations";
import type { Agency, Diet, DietAgencyAssignment, Phase, ScopeOfWork, WorkPackage } from "../types";

const emptyForm = { agencyId: "", assignmentOrderNumber: "", assignmentOrderDate: "", remarks: "" };

export function DietDetailPage() {
  const { dietId = "" } = useParams(), { profile, accessScope } = useAuth();
  const role = profile?.systemRole || profile?.role, canManage = role === "scert_admin";
  const [diet, setDiet] = useState<Diet | null>(null), [phases, setPhases] = useState<Phase[]>([]), [agencies, setAgencies] = useState<Agency[]>([]);
  const [assignments, setAssignments] = useState<DietAgencyAssignment[]>([]), [packages, setPackages] = useState<WorkPackage[]>([]);
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);
  const [formOpen, setFormOpen] = useState(false), [editing, setEditing] = useState<DietAgencyAssignment | null>(null), [superseding, setSuperseding] = useState<DietAgencyAssignment | null>(null), [form, setForm] = useState(emptyForm);
  const [effectiveDate, setEffectiveDate] = useState(""), [reason, setReason] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [saving, setSaving] = useState(false);
  const phaseName = useMemo(() => phases.find((item) => item.id === diet?.phaseId)?.name || diet?.phaseYear || "", [phases, diet]);
  const eligibleAgencies = agencies.filter((item) => item.active === true && item.agencyCategory === "executing_agency");

  async function load() {
    try {
      if (!canAccessDiet(accessScope, dietId)) { setDiet(null); setError("You are not authorised to access this DIET."); return; }
      const [dietData, phaseData, assignmentData, packageData, scopeData, agencyData] = await Promise.all([getAccessibleDiets(accessScope!), getPhases(), getAssignmentsForDiet(dietId), getWorkPackagesForDiet(dietId), getScopesForDiet(dietId), canManage ? getAgencies() : Promise.resolve([])]);
      setDiet(dietData.find((item)=>item.id===dietId)||null); setPhases(phaseData); setAssignments(assignmentData); setPackages(packageData); setScopes(scopeData); setAgencies(agencyData);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load DIET execution details."); }
  }
  useEffect(() => { if (accessScope) void load(); }, [dietId, canManage, accessScope]);

  function openEdit(item?: DietAgencyAssignment) {
    setEditing(item || null); setSuperseding(null); setFormOpen(true); setError("");
    setForm(item ? { agencyId: item.executingAgencyId, assignmentOrderNumber: item.assignmentOrderNumber || "", assignmentOrderDate: item.assignmentOrderDate || "", remarks: item.remarks || "" } : emptyForm);
  }
  function openSupersede(item: DietAgencyAssignment) { setSuperseding(item); setEditing(null); setFormOpen(true); setForm(emptyForm); setEffectiveDate(""); setReason(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!diet) return; const agency = agencies.find((item) => item.id === form.agencyId); if (!agency) return setError("Select an active executing agency.");
    const input = { diet, agency, phaseName, ...form }; setSaving(true); setError("");
    try { if (superseding) await supersedeDietAgencyAssignment(superseding.id, input, effectiveDate, reason); else if (editing) await updateDietAgencyAssignment(editing.id, input); else await createDietAgencyAssignment(input); setFormOpen(false); setEditing(null); setSuperseding(null); await load(); setNotice(superseding ? "Assignment superseded; replacement saved as draft." : editing ? "Draft assignment updated." : "Executing agency assignment created as draft."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save assignment."); } finally { setSaving(false); }
  }
  async function act(action: "activate" | "cancel", item: DietAgencyAssignment) {
    const remarks = action === "cancel" ? window.prompt("Reason for cancellation:") : ""; if (action === "cancel" && !remarks) return;
    setError(""); try { action === "activate" ? await activateDietAgencyAssignment(item.id) : await cancelDietAgencyAssignment(item.id, remarks || ""); await load(); setNotice(action === "activate" ? "Assignment activated." : "Assignment cancelled; history preserved."); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Unable to update assignment."); }
  }

  return <><header className="page-header page-header-actions"><div><span className="eyebrow">DIET detail</span><h1>{diet?.name || "DIET detail"}</h1><p>{diet?.district || ""} · {phaseName}</p></div>{canManage && <button className="primary-button" onClick={() => openEdit()}><Plus size={18}/> Assign Executing Agency</button>}</header>
    {notice && <div className="success-banner">{notice}</div>}{error && <div className="error-banner">{error}</div>}
    <section className="detail-grid"><div><span>District</span><strong>{diet?.district || "—"}</strong></div><div><span>Phase</span><strong>{phaseName || "—"}</strong></div><div><span>Status</span><strong>{diet?.status?.replaceAll("_", " ") || "—"}</strong></div><div><span>Physical progress</span><strong>{diet?.physicalProgressPercent ?? 0}%</strong></div></section>
    {formOpen && canManage && <section className="section-band"><div className="section-title"><h2>{superseding ? "Supersede Assignment" : editing ? "Edit Draft Assignment" : "Assign Executing Agency"}</h2><button className="secondary-button" onClick={() => setFormOpen(false)}><X size={16}/>Close</button></div><form className="agency-form" onSubmit={save}>
      <label>DIET<input value={diet?.name || ""} readOnly/></label><label>Project Phase<input value={phaseName} readOnly/></label>
      <label>Executing Agency *<select value={form.agencyId} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, agencyId: e.target.value })}><option value="">Select active executing agency</option>{eligibleAgencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Assignment Order Number<input value={form.assignmentOrderNumber} onChange={(e) => setForm({ ...form, assignmentOrderNumber: e.target.value })}/></label><label>Assignment Order Date<input type="date" value={form.assignmentOrderDate} onChange={(e) => setForm({ ...form, assignmentOrderDate: e.target.value })}/></label>
      {superseding && <><label>Replacement Effective Date *<input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}/></label><label>Reason *<input value={reason} onChange={(e) => setReason(e.target.value)}/></label></>}
      <label className="agency-form-wide">Remarks<textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}/></label><div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving..." : superseding ? "Supersede and Create Draft" : editing ? "Update Draft" : "Create Draft Assignment"}</button></div>
    </form></section>}
    <section className="table-wrap"><div className="section-title"><h2>Executing Agencies</h2><span>{assignments.length} assignments</span></div><table><thead><tr><th>Agency</th><th>Agency Type</th><th>Assignment Order</th><th>Assignment Date</th><th>Status</th><th>Effective Period</th><th>Actions</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td>{item.executingAgencyName}</td><td>{item.executingAgencyType}</td><td>{item.assignmentOrderNumber || "—"}</td><td>{item.assignmentOrderDate || "—"}</td><td><span className={`status-pill ${item.status === "active" ? "completed" : item.status === "cancelled" ? "delayed" : ""}`}>{assignmentStatusLabels[item.status]}</span></td><td>{item.effectiveFrom || "—"} to {item.effectiveTo || "Open"}</td><td><div className="table-actions"><button className="link-button">View</button>{canManage && item.status === "draft" && <button className="link-button" onClick={() => openEdit(item)}>Edit Assignment</button>}{canManage && item.status === "draft" && <button className="link-button" onClick={() => void act("activate", item)}>Activate</button>}{canManage && ["draft", "active"].includes(item.status) && <button className="link-button" onClick={() => openSupersede(item)}>Supersede</button>}{canManage && ["draft", "active"].includes(item.status) && <button className="link-button" onClick={() => void act("cancel", item)}>Cancel</button>}</div></td></tr>)}{!assignments.length && <tr><td colSpan={7}>No executing agencies assigned.</td></tr>}</tbody></table></section>
    <section className="table-wrap"><div className="section-title"><h2>Scope of Work</h2>{(canManage || role === "diet_nodal_officer") && <Link className="primary-button" to={`/scopes?create=1&dietId=${dietId}`}>Create Scope</Link>}</div><table><thead><tr><th>Scope Title</th><th>Executing Agency</th><th>Categories</th><th>Activities</th><th>Status</th><th>Prepared By</th><th>Actions</th></tr></thead><tbody>{scopes.map(item=><tr key={item.id}><td>{item.scopeTitle}</td><td>{item.executingAgencyName}</td><td>{item.scopeCategories.length}</td><td>{item.activityIds.length}</td><td>{item.status.replaceAll("_"," ")}</td><td>{item.preparedBy}</td><td><Link className="link-button" to="/scopes">View</Link></td></tr>)}{!scopes.length&&<tr><td colSpan={7}>No scope of work has been prepared.</td></tr>}</tbody></table></section>
    <DietActivityFinancialSummary dietId={dietId}/>
    <section className="table-wrap"><div className="section-title"><h2>Work Packages</h2>{canManage && <Link className="primary-button" to={`/work-packages?create=1&dietId=${dietId}`}>Create Work Package</Link>}</div><table><thead><tr><th>Package Code</th><th>Title</th><th>Executing Agency</th><th>Category</th><th>Financial Basis</th><th>Status</th></tr></thead><tbody>{packages.map((item) => <tr key={item.id}><td><Link to={`/work-packages/${item.id}`}>{item.packageCode}</Link></td><td>{item.packageTitle}</td><td>{item.executingAgencyName}</td><td>{labelWorkCategory(item.workCategory)}</td><td>{formatIndianCurrency(getPackageFinancialBasis(item))}</td><td>{workPackageStatusLabels[item.status]}</td></tr>)}{!packages.length && <tr><td colSpan={6}>No work packages created for this DIET.</td></tr>}</tbody></table></section>
  </>;
}
