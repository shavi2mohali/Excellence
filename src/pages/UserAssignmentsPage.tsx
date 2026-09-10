import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import type { Agency, AppUser, Diet, UserAssignment } from "../types";
import {
  assignOrganisationDiets, deactivateUserAssignment, getApprovedAssignableUsers,
  getAssignableAgencies, getAssignableDiets, getUserAssignmentHistory,
} from "../services/userAssignmentService";

const label = (value?: string | null) => value ? value.replaceAll("_", " ").toUpperCase() : "—";
const date = (value: unknown) => typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function" ? value.toDate().toLocaleString() : "—";

export function UserAssignmentsPage() {
  const [users, setUsers] = useState<AppUser[]>([]), [diets, setDiets] = useState<Diet[]>([]), [agencies, setAgencies] = useState<Agency[]>([]);
  const [selected, setSelected] = useState<AppUser | null>(null), [history, setHistory] = useState<UserAssignment[]>([]);
  const [mode, setMode] = useState<"assign" | "view" | "deactivate" | null>(null), [targetDietIds, setTargetDietIds] = useState<string[]>([]), [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState(""), [role, setRole] = useState("all"), [district, setDistrict] = useState("all"), [assignment, setAssignment] = useState("all"), [active, setActive] = useState("all"), [systemRole, setSystemRole] = useState("all");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const [u, d, a] = await Promise.all([getApprovedAssignableUsers(), getAssignableDiets(), getAssignableAgencies()]); setUsers(u); setDiets(d); setAgencies(a); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load assignments."); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const dietNames = useMemo(() => new Map(diets.map(d => [d.id, d.name])), [diets]);
  const agencyNames = useMemo(() => new Map(agencies.map(a => [a.id, a.name])), [agencies]);
  const districts = [...new Set(users.map(u => u.districtName).filter(Boolean))] as string[];
  const filtered = users.filter(u => {
    const term = search.trim().toLowerCase(); const status = u.assignmentStatus ?? "unassigned";
    const haystack = [u.name, u.displayName, u.email, u.mobile, u.organisationName, u.districtName, u.architectureZoneLabel, ...(u.assignedDietIds ?? []).map(id => dietNames.get(id)), agencyNames.get(u.primaryAgencyId ?? "")].join(" ").toLowerCase();
    return (!term || haystack.includes(term)) && (role === "all" || u.organisationRole === role) && (district === "all" || u.districtName === district)
      && (assignment === "all" || status === assignment) && (active === "all" || (active === "active") === (u.active === true)) && (systemRole === "all" || (u.systemRole ?? u.role) === systemRole);
  });
  const unassigned = users.filter(u => (u.assignmentStatus ?? "unassigned") === "unassigned");

  async function open(user: AppUser, nextMode: typeof mode) {
    setSelected(user); setMode(nextMode); setRemarks(user.assignmentRemarks ?? ""); setTargetDietIds(user.assignedDietIds ?? []); setError("");
    try { setHistory(await getUserAssignmentHistory(user.uid)); } catch { setHistory([]); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError("");
    try {
      if (mode === "deactivate") await deactivateUserAssignment(selected, remarks);
      else await assignOrganisationDiets(selected, diets.filter(d => targetDietIds.includes(d.id)), remarks);
      setNotice(mode === "deactivate" ? "Assignment deactivated." : "Assignment saved."); setMode(null); setSelected(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save assignment."); } finally { setSaving(false); }
  }

  return <>
    <header className="page-header"><span className="eyebrow">Administration</span><h1>Organisation DIET Responsibility</h1><p>Maintain DIET responsibility, reassign projects, or deactivate access for existing organisation accounts. New accounts receive responsibility during approval.</p></header>
    {notice && <div className="success-banner">{notice}</div>}{error && <div className="error-banner">{error}</div>}
    <div className="stat-grid assignment-stats">
      <section className="stat-card"><span>Total approved users</span><strong>{users.length}</strong></section><section className="stat-card"><span>Assigned users</span><strong>{users.filter(u => u.assignmentStatus === "assigned").length}</strong></section><section className="stat-card"><span>Unassigned users</span><strong>{unassigned.length}</strong></section>
      {(["diet", "pwd", "rdp", "architecture_department"] as const).map(r => <section className="stat-card" key={r}><span>{r === "architecture_department" ? "Architecture accounts needing access correction" : `${r.toUpperCase()} accounts needing access correction`}</span><strong>{unassigned.filter(u => u.organisationRole === r).length}</strong></section>)}
    </div>
    <section className="filters assignment-filters"><label>Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, organisation, zone or assignment" /></label><label>Organisation role<select value={role} onChange={e => setRole(e.target.value)}><option value="all">All</option><option value="diet">DIET</option><option value="pwd">PWD</option><option value="rdp">RDP</option><option value="architecture_department">Architecture Department</option></select></label><label>District<select value={district} onChange={e => setDistrict(e.target.value)}><option value="all">All</option>{districts.map(d => <option key={d}>{d}</option>)}</select></label><label>Assignment<select value={assignment} onChange={e => setAssignment(e.target.value)}><option value="all">All</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option><option value="inactive">Inactive</option></select></label><label>Account<select value={active} onChange={e => setActive(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label>System role<select value={systemRole} onChange={e => setSystemRole(e.target.value)}><option value="all">All</option><option value="diet_nodal_officer">DIET nodal officer</option><option value="agency_user">Agency user</option><option value="architecture_user">Architecture user</option></select></label></section>
    <section className="table-wrap"><div className="section-title"><h2>Approved users</h2><span>{loading ? "Loading..." : `${filtered.length} users`}</span></div><table><thead><tr><th>User Name</th><th>Email</th><th>Mobile</th><th>Organisation Role</th><th>Organisation Name</th><th>District / Zone</th><th>System Role</th><th>Assigned DIETs</th><th>Assigned Agency</th><th>Assignment Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(u => <tr key={u.uid}><td>{u.name ?? u.displayName ?? "—"}</td><td>{u.email}</td><td>{u.mobile ?? "—"}</td><td>{label(u.organisationRole)}</td><td>{u.organisationName ?? "—"}</td><td>{u.architectureZoneLabel ?? u.districtName ?? "—"}</td><td>{label(u.systemRole ?? u.role)}</td><td>{(u.assignedDietIds ?? []).map(id => dietNames.get(id)).filter(Boolean).join(", ") || dietNames.get(u.primaryDietId ?? "") || "�"}</td><td>{agencyNames.get(u.primaryAgencyId ?? "") ?? "—"}</td><td><span className={`status-pill ${u.assignmentStatus === "assigned" ? "completed" : u.assignmentStatus === "inactive" ? "delayed" : "in_progress"}`}>{u.assignmentStatus ?? "unassigned"}</span></td><td><div className="table-actions"><button className="link-button" onClick={() => void open(u, "assign")}>{u.assignmentStatus === "assigned" ? "Reassign" : "Assign"}</button><button className="link-button" onClick={() => void open(u, "view")}><Eye size={14}/>View</button>{u.assignmentStatus === "assigned" && <button className="link-button" onClick={() => void open(u, "deactivate")}>Deactivate Assignment</button>}</div></td></tr>)}{!loading && !filtered.length && <tr><td colSpan={11}>No approved assignable users match the filters.</td></tr>}</tbody></table></section>
    {selected && mode && <section className="section-band review-panel"><div className="section-title"><h2>{mode === "view" ? "Assignment details" : mode === "deactivate" ? "Deactivate assignment" : selected.assignmentStatus === "assigned" ? "Reassign user" : "Assign user"}</h2><button className="secondary-button" onClick={() => setMode(null)}>Close</button></div><div className="detail-grid"><div><span>User</span><strong>{selected.name ?? selected.displayName ?? "—"}</strong></div><div><span>Email</span><strong>{selected.email}</strong></div><div><span>Registered organisation</span><strong>{selected.organisationName ?? "—"}</strong></div><div><span>{selected.organisationRole === "architecture_department" ? "Registered Architecture Zone" : "Registered district"}</span><strong>{selected.architectureZoneLabel ?? selected.districtName ?? "—"}</strong></div><div><span>Approval</span><strong>{selected.approvalStatus ?? "—"}</strong></div><div><span>Current assignment</span><strong>{(selected.assignedDietIds ?? []).map(id => dietNames.get(id)).filter(Boolean).join(", ") || "None"}</strong></div></div>
      {mode !== "view" && <form className="agency-form review-form" onSubmit={submit}>{mode === "assign" && <fieldset className="agency-form-wide"><legend>Assigned DIETs</legend>{diets.map(diet => <label className="checkbox-row" key={diet.id}><input type="checkbox" checked={targetDietIds.includes(diet.id)} onChange={() => setTargetDietIds(ids => ids.includes(diet.id) ? ids.filter(id => id !== diet.id) : selected.organisationRole === "diet" ? [diet.id] : [...ids, diet.id])}/>{diet.name}</label>)}</fieldset>}<label>Assignment remarks<textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} required={mode === "deactivate"}/></label><div className="form-actions"><button className={`primary-button ${mode === "deactivate" ? "danger-button" : ""}`} disabled={saving}>{saving ? "Saving..." : mode === "deactivate" ? "Deactivate Assignment" : "Save Assignment"}</button></div></form>}
      <div className="section-band"><div className="section-title"><h2>Assignment history</h2><span>{history.length} records</span></div>{history.length ? <table><thead><tr><th>Type</th><th>Assignment</th><th>Remarks</th><th>Assigned by</th><th>Date</th><th>Status</th></tr></thead><tbody>{history.map(h => <tr key={h.id}><td>{label(h.assignmentType)}</td><td>{h.assignedDietNames?.join(", ") ?? h.dietName ?? h.agencyName ?? "—"}</td><td>{h.remarks || "—"}</td><td>{h.assignedBy || "—"}</td><td>{date(h.assignedAt)}</td><td>{h.active ? "Active" : "Ended"}</td></tr>)}</tbody></table> : <div className="empty-state">No assignment history.</div>}</div>
    </section>}
  </>;
}
