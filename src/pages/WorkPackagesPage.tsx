import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../contexts/AuthContext";
import { getActivityMaster, getPhases } from "../lib/firestore";
import { getAccessibleDiets } from "../services/accessScopeService";
import { getAssignmentsForAgency, getAssignmentsForDiet, getDietAgencyAssignments } from "../services/dietAgencyAssignmentService";
import { approveWorkPackageForTender, concurWorkPackageByDiet, createWorkPackage, finaliseWorkPackageByAgency, getWorkPackages, getWorkPackagesForAgency, getWorkPackagesForDiet, requestDietWorkPackageRevision, returnWorkPackageForRevision, reviewWorkPackage, sendWorkPackageToDiet, startDietWorkPackageReview, submitWorkPackageToScert, updateWorkPackage } from "../services/workPackageService";
import { getScopeOfWorks, getScopesForAgency, getScopesForDiet } from "../services/scopeOfWorkService";
import { getDietActivityFinancialAvailability, type ActivityFinancialAvailability } from "../services/dietActivityFinancialService";
import { labelWorkCategory, workCategoryOptions, workPackageStatusLabels } from "../constants/projectExecution";
import { calculateFundingShare, getPackageFinancialBasis } from "../utils/fundingCalculations";
import { formatIndianCurrency } from "../utils/currency";
import type { ActivityMaster, Diet, DietAgencyAssignment, Phase, ScopeOfWork, WorkCategory, WorkPackage, WorkPackageActivityAllocation } from "../types";

const emptyForm = { dietId: "", assignmentId: "", scopeId: "", packageTitle: "", packageDescription: "", workCategory: "" as WorkCategory | "", activityAmounts: {} as Record<string,string>, administrativeApprovalAmount: "", technicalSanctionAmount: "", remarks: "" };
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()];

export function WorkPackagesPage() {
  const { profile, accessScope } = useAuth();
  const [searchParams] = useSearchParams();
  const role = profile?.systemRole || profile?.role;
  const canApprove = role === "scert_admin";
  const agencyUser=role==="agency_user",dietUser=role==="diet_nodal_officer";
  const canCreate = agencyUser;
  const [packages, setPackages] = useState<WorkPackage[]>([]), [assignments, setAssignments] = useState<DietAgencyAssignment[]>([]);
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]), [phases, setPhases] = useState<Phase[]>([]), [activities, setActivities] = useState<ActivityMaster[]>([]);
  const [search, setSearch] = useState(""), [phase, setPhase] = useState("all"), [diet, setDiet] = useState("all"), [district, setDistrict] = useState("all"), [agency, setAgency] = useState("all"), [category, setCategory] = useState("all"), [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1"), [form, setForm] = useState({ ...emptyForm, dietId: searchParams.get("dietId") || "" });
  const [editing, setEditing] = useState<WorkPackage | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [reviewComment,setReviewComment]=useState("");
  const [availability,setAvailability]=useState<ActivityFinancialAvailability[]>([]);

  async function load() {
    const dietIds = profile?.assignedDietIds || [], agencyIds = profile?.assignedAgencyIds || [];
    const assignmentPromise = canApprove || ["scert_viewer", "finance_officer", "monitoring_officer"].includes(role || "")
      ? getDietAgencyAssignments()
      : role === "diet_nodal_officer" ? Promise.all(dietIds.map(getAssignmentsForDiet)).then((groups) => unique(groups.flat()))
      : role === "agency_user" ? Promise.all(agencyIds.map(getAssignmentsForAgency)).then((groups) => unique(groups.flat())) : Promise.resolve([]);
    const packagePromise = canApprove || ["scert_viewer", "finance_officer", "monitoring_officer"].includes(role || "")
      ? getWorkPackages()
      : role === "diet_nodal_officer" ? Promise.all(dietIds.map(getWorkPackagesForDiet)).then((groups) => unique(groups.flat()))
      : role === "agency_user" ? Promise.all(agencyIds.map(getWorkPackagesForAgency)).then((groups) => unique(groups.flat())) : Promise.resolve([]);
    const scopePromise = canApprove || ["scert_viewer", "finance_officer", "monitoring_officer"].includes(role || "") ? getScopeOfWorks() : role === "diet_nodal_officer" ? Promise.all(dietIds.map(getScopesForDiet)).then((groups) => unique(groups.flat())) : role === "agency_user" ? Promise.all(agencyIds.map(getScopesForAgency)).then((groups) => unique(groups.flat())) : Promise.resolve([]);
    try {
      const [assignmentData, packageData, scopeData, dietData, phaseData, activityData] = await Promise.all([assignmentPromise, packagePromise, scopePromise, accessScope ? getAccessibleDiets(accessScope) : Promise.resolve([]), getPhases(), getActivityMaster()]);
      setAssignments(assignmentData); setPackages(packageData); setScopes(scopeData); setDiets(dietData); setPhases(phaseData); setActivities(activityData.filter((item) => item.active !== false));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load work packages."); }
  }

  useEffect(() => { if (profile && accessScope) void load(); }, [profile, accessScope]);
  useEffect(()=>{if(!form.dietId){setAvailability([]);return;}getDietActivityFinancialAvailability(form.dietId,editing?.id).then(setAvailability).catch(e=>setError(e instanceof Error?e.message:"Unable to load activity financial availability."));},[form.dietId,editing?.id,packages]);
  const activeAssignments = assignments.filter((item) => item.status === "active" && (!form.dietId || item.dietId === form.dietId));
  const selectedAssignment = assignments.find((item) => item.id === form.assignmentId);
  const selectedScope = scopes.find((item) => item.id === form.scopeId);
  const estimatedCost=Object.values(form.activityAmounts).reduce((n,v)=>n+Number(v||0),0);
  const financialPreview = calculateFundingShare(getPackageFinancialBasis({ estimatedCost, administrativeApprovalAmount: Number(form.administrativeApprovalAmount || 0), technicalSanctionAmount: Number(form.technicalSanctionAmount || 0) }));
  const districts = [...new Set(packages.map((item) => item.districtName).filter(Boolean))].sort();
  const agencies = [...new Map(assignments.map((item) => [item.executingAgencyId, item.executingAgencyName])).entries()];
  const filtered = useMemo(() => packages.filter((item) => {
    const term = search.trim().toLowerCase();
    return (!term || [item.packageCode, item.packageTitle, item.dietName, item.executingAgencyName].join(" ").toLowerCase().includes(term))
      && (phase === "all" || item.phaseId === phase) && (diet === "all" || item.dietId === diet)
      && (district === "all" || item.districtName === district) && (agency === "all" || item.executingAgencyId === agency)
      && (category === "all" || item.workCategory === category) && (status === "all" || item.status === status);
  }), [packages, search, phase, diet, district, agency, category, status]);

  function openEdit(item: WorkPackage) {
    setEditing(item); setFormOpen(true); setError(""); setNotice("");
    const activityAmounts=Object.fromEntries((item.activityAllocations||[]).map(x=>[x.activityId,String(x.packageAllocatedAmount)]));
    setForm({ dietId: item.dietId, assignmentId: item.dietAgencyAssignmentId, scopeId: item.scopeOfWorkId || "", packageTitle: item.packageTitle, packageDescription: item.packageDescription, workCategory: item.workCategory, activityAmounts, administrativeApprovalAmount: item.administrativeApprovalAmount ? String(item.administrativeApprovalAmount) : "", technicalSanctionAmount: item.technicalSanctionAmount ? String(item.technicalSanctionAmount) : "", remarks: item.remarks || "" });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!selectedAssignment) return setError("Select an active executing agency assignment.");
    if (!form.workCategory) return setError("Select a work category.");
    const activityAllocations=availability.filter(x=>Number(form.activityAmounts[x.financial.activityId||""]||0)>0).map(x=>({activityId:x.financial.activityId!,activityCode:x.financial.activityCode,activityName:x.financial.activityName,financialRecordId:x.financial.id,currentEffectiveApprovedAmount:x.financial.currentEffectiveApprovedAmount,principalAllocation:x.financial.principalAllocation,agencyAllocation:x.financial.agencyAllocation,packageAllocatedAmount:Number(form.activityAmounts[x.financial.activityId!]||0)} as WorkPackageActivityAllocation));
    const input = { assignment: selectedAssignment, scope: selectedScope, packageTitle: form.packageTitle, packageDescription: form.packageDescription, workCategory: form.workCategory, activityAllocations, administrativeApprovalAmount: Number(form.administrativeApprovalAmount || 0), technicalSanctionAmount: Number(form.technicalSanctionAmount || 0), remarks: form.remarks };
    setSaving(true);
    try { editing ? await updateWorkPackage(editing.id, input) : await createWorkPackage(input); setFormOpen(false); setEditing(null); setForm(emptyForm); await load(); setNotice(editing ? "Work package updated." : "Work package created as draft."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save work package."); }
    finally { setSaving(false); }
  }

  async function act(action: "send_diet"|"diet_review"|"diet_revision"|"diet_concur"|"finalise"|"submit_scert"|"scert_review"|"scert_return"|"approve", id: string) {
    setError(""); setNotice("");
    try { if(action==="send_diet")await sendWorkPackageToDiet(id);else if(action==="diet_review")await startDietWorkPackageReview(id);else if(action==="diet_revision")await requestDietWorkPackageRevision(id,reviewComment);else if(action==="diet_concur")await concurWorkPackageByDiet(id,reviewComment);else if(action==="finalise")await finaliseWorkPackageByAgency(id);else if(action==="submit_scert")await submitWorkPackageToScert(id);else if(action==="scert_review")await reviewWorkPackage(id);else if(action==="scert_return")await returnWorkPackageForRevision(id,reviewComment);else await approveWorkPackageForTender(id);setReviewComment("");await load();setNotice(action==="approve"?"Package approved for tender. No tender has been created.":"Package workflow updated."); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Unable to update package."); }
  }

  return <>
    <header className="page-header page-header-actions"><div><span className="eyebrow">Project execution</span><h1>Work Packages</h1><p>Group approved activities under active DIET–executing agency assignments and prepare them for tender approval.</p></div>{canCreate && <button className="primary-button" onClick={() => { setEditing(null); setForm({ ...emptyForm, dietId: searchParams.get("dietId") || "" }); setFormOpen(true); }}><Plus size={18}/> Create Work Package</button>}</header>
    <div className="stat-grid compact-stats"><StatCard label="Draft" value={packages.filter((item) => item.status === "draft").length}/><StatCard label="Under review" value={packages.filter((item) => item.status === "under_review").length}/><StatCard label="Approved for tender" value={packages.filter((item) => item.status === "approved_for_tender").length}/><StatCard label="Current financial basis" value={formatIndianCurrency(packages.reduce((sum, item) => sum + getPackageFinancialBasis(item), 0))}/></div>
    {notice && <div className="success-banner">{notice}</div>}{error && <div className="error-banner">{error}</div>}
    {formOpen && canCreate && <section className="section-band"><div className="section-title"><h2>{editing ? "Edit Draft Work Package" : "Create Work Package"}</h2><button className="secondary-button" onClick={() => setFormOpen(false)}><X size={16}/>Close</button></div><form className="agency-form" onSubmit={save}>
      <label>DIET *<select value={form.dietId} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, dietId: e.target.value, assignmentId: "" })}><option value="">Select DIET</option>{diets.filter((item) => assignments.some((a) => a.status === "active" && a.dietId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Executing Agency Assignment *<select value={form.assignmentId} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })}><option value="">Select active assignment</option>{activeAssignments.map((item) => <option key={item.id} value={item.id}>{item.executingAgencyName}</option>)}</select></label>
      <label>Released Scope *<select value={form.scopeId} onChange={(e) => setForm({ ...form, scopeId: e.target.value, activityAmounts: {} })}><option value="">Select scope</option>{scopes.filter((item) => ["released_to_executing_agency","mutually_agreed","approved"].includes(item.status)&&item.dietId === form.dietId && (!form.assignmentId || item.dietAgencyAssignmentId === form.assignmentId)).map((item) => <option key={item.id} value={item.id}>{item.scopeTitle} — {item.status==="approved"||item.status==="mutually_agreed"?"Legacy released":item.status.replaceAll("_", " ")}</option>)}</select></label>
      <label>Package Title *<input value={form.packageTitle} onChange={(e) => setForm({ ...form, packageTitle: e.target.value })}/></label>
      <label>Work Category *<select value={form.workCategory} onChange={(e) => setForm({ ...form, workCategory: e.target.value as WorkCategory })}><option value="">Select category</option>{workCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="agency-form-wide">Package Description *<textarea rows={3} value={form.packageDescription} onChange={(e) => setForm({ ...form, packageDescription: e.target.value })}/></label>
      <div className="agency-form-wide table-wrap"><table><thead><tr><th>Activity</th><th>Agency Allocation</th><th>Already Packaged</th><th>Available</th><th>This Package (₹)</th></tr></thead><tbody>{availability.filter(x=>selectedScope?.activityIds.includes(x.financial.activityId||"")).map(x=><tr key={x.financial.id}><td>{x.financial.activityCode}<small>{x.financial.activityName}</small></td><td>{formatIndianCurrency(x.financial.agencyAllocation)}</td><td>{formatIndianCurrency(x.committedAmount)}</td><td>{formatIndianCurrency(x.availableAmount)}</td><td><input type="number" min="0" max={x.availableAmount} step="0.01" disabled={x.financial.agencyAllocation<=0} value={form.activityAmounts[x.financial.activityId||""]||""} onChange={e=>setForm({...form,activityAmounts:{...form.activityAmounts,[x.financial.activityId!]:e.target.value}})}/>{x.financial.agencyAllocation<=0&&<small>Principal-only activity</small>}</td></tr>)}{!selectedScope&&<tr><td colSpan={5}>Select an approved Scope first.</td></tr>}</tbody></table></div>
      <label>Estimated Cost<input value={formatIndianCurrency(estimatedCost)} readOnly/></label>
      <label>Administrative Approval Amount<input type="number" min="0" step="0.01" readOnly={!canApprove} value={form.administrativeApprovalAmount} onChange={(e) => setForm({ ...form, administrativeApprovalAmount: e.target.value })}/></label>
      <label>Technical Sanction Amount<input type="number" min="0" step="0.01" readOnly={!canApprove} value={form.technicalSanctionAmount} onChange={(e) => setForm({ ...form, technicalSanctionAmount: e.target.value })}/></label>
      <label>Funding Pattern<input value="Centre 60% : State 40%" readOnly/></label>
      <div className="agency-form-wide detail-grid compact-stats"><div><span>Current Financial Basis</span><strong>{formatIndianCurrency(financialPreview.totalAmount)}</strong></div><div><span>Centre Share 60%</span><strong>{formatIndianCurrency(financialPreview.centralShare)}</strong></div><div><span>State Share 40%</span><strong>{formatIndianCurrency(financialPreview.stateShare)}</strong></div></div>
      <label className="agency-form-wide">Remarks<textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}/></label><div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving..." : editing ? "Update Package" : "Create Draft Package"}</button></div>
    </form></section>}
    {(dietUser||canApprove)&&<section className="section-band"><div className="section-title"><h2>Official Review Comment</h2></div><label>Comment<textarea value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Required when requesting revision"/></label></section>}
    <section className="filters package-filters"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, title, DIET, or agency"/></label><label>Phase<select value={phase} onChange={(e) => setPhase(e.target.value)}><option value="all">All</option>{phases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>DIET<select value={diet} onChange={(e) => setDiet(e.target.value)}><option value="all">All</option>{diets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>District<select value={district} onChange={(e) => setDistrict(e.target.value)}><option value="all">All</option>{districts.map((item) => <option key={item}>{item}</option>)}</select></label><label>Executing Agency<select value={agency} onChange={(e) => setAgency(e.target.value)}><option value="all">All</option>{agencies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All</option>{workCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{Object.entries(workPackageStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></section>
    <section className="table-wrap"><div className="section-title"><h2>Package register</h2><span>{filtered.length} packages</span></div><table><thead><tr><th>Package Code</th><th>Package Title</th><th>Phase</th><th>DIET</th><th>Executing Agency</th><th>Category</th><th>Estimated Cost</th><th>Financial Basis</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><Link to={`/work-packages/${item.id}`}>{item.packageCode}</Link></td><td>{item.packageTitle}<small>Revision {item.packageRevision||1}</small></td><td>{item.phaseName}</td><td>{item.dietName}</td><td>{item.executingAgencyName}</td><td>{labelWorkCategory(item.workCategory)}</td><td>{formatIndianCurrency(item.estimatedCost)}</td><td>{formatIndianCurrency(getPackageFinancialBasis(item))}</td><td><span className="status-pill">{workPackageStatusLabels[item.status]}</span></td><td><div className="table-actions"><Link className="link-button" to={`/work-packages/${item.id}`}>View</Link>{agencyUser&&["draft","agency_revision","diet_revision_requested","scert_revision_required","revision_required"].includes(item.status)&&<button className="link-button" onClick={()=>openEdit(item)}>Edit</button>}{agencyUser&&["draft","agency_revision","diet_revision_requested","scert_revision_required","revision_required"].includes(item.status)&&<button className="link-button" onClick={()=>void act("send_diet",item.id)}>Send to DIET</button>}{dietUser&&item.status==="sent_to_diet"&&<button className="link-button" onClick={()=>void act("diet_review",item.id)}>Start Review</button>}{dietUser&&["sent_to_diet","diet_review"].includes(item.status)&&<button className="link-button" onClick={()=>void act("diet_revision",item.id)}>Request Revision</button>}{dietUser&&["sent_to_diet","diet_review"].includes(item.status)&&<button className="link-button" onClick={()=>void act("diet_concur",item.id)}>Concur</button>}{agencyUser&&item.status==="diet_concurred"&&<button className="link-button" onClick={()=>void act("finalise",item.id)}>Finalise</button>}{agencyUser&&item.status==="ready_for_scert"&&<button className="link-button" onClick={()=>void act("submit_scert",item.id)}>Submit to SCERT</button>}{canApprove&&["submitted_to_scert","submitted"].includes(item.status)&&<button className="link-button" onClick={()=>void act("scert_review",item.id)}>Start Review</button>}{canApprove&&["submitted_to_scert","scert_under_review","submitted","under_review"].includes(item.status)&&<button className="link-button" onClick={()=>void act("scert_return",item.id)}>Return</button>}{canApprove&&["submitted_to_scert","scert_under_review","submitted","under_review"].includes(item.status)&&<button className="link-button" onClick={()=>void act("approve",item.id)}>Approve for Tender</button>}</div></td></tr>)}{!filtered.length&&<tr><td colSpan={10}>No work packages match the current filters.</td></tr>}</tbody></table></section>
  </>;
}
