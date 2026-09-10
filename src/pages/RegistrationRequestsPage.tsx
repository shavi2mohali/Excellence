import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { punjabDistricts } from "../constants/punjabDistricts";
import { approveRegistration, getRegistrationRequests, rejectRegistration } from "../services/approvalService";
import { getRequestedSystemRole } from "../constants/organisationRoles";
import { getDiets } from "../lib/firestore";
import type { Diet, RegistrationRequest } from "../types";

function formatDate(value: unknown) {
  if (!value) return "--";
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString();
  }
  return "--";
}

export function RegistrationRequestsPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [roleFilter, setRoleFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "approve" | "reject" | null>(null);
  const [assignedDietIds, setAssignedDietIds] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const [reviewing, setReviewing] = useState(false);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const [requestData, dietData] = await Promise.all([getRegistrationRequests(), getDiets()]);
      setRequests(requestData);
      setDiets(dietData);
    } catch (loadError) {
      setRequests([]);
      setError(loadError instanceof Error ? loadError.message : "Registration requests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
    }),
    [requests],
  );

  const filteredRequests = requests.filter((request) => {
    const term = search.trim().toLowerCase();
    const haystack = `${request.contactPersonName} ${request.organisationName} ${request.email} ${request.mobile} ${request.architectureZoneLabel ?? ""}`.toLowerCase();
    return (
      (statusFilter === "all" || request.status === statusFilter) &&
      (roleFilter === "all" || request.organisationRole === roleFilter) &&
      (districtFilter === "all" || request.districtId === districtFilter) &&
      (!term || haystack.includes(term))
    );
  });

  function openDialog(request: RegistrationRequest, mode: "view" | "approve" | "reject") {
    setSelectedRequest(request);
    setDialogMode(mode);
    setAssignedDietIds(request.registeredDietId ? [request.registeredDietId] : []);
    setRemarks("");
    setNotice("");
    setError("");
  }

  function closeDialog() {
    setSelectedRequest(null);
    setDialogMode(null);
  }

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest) return;
    setReviewing(true);
    setError("");

    try {
      await approveRegistration({
        request: selectedRequest,
        assignedDietIds,
        remarks,
      });
      closeDialog();
      setNotice("Registration approved successfully.");
      await loadRequests();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve registration.");
    } finally {
      setReviewing(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest) return;
    setReviewing(true);
    setError("");

    try {
      await rejectRegistration(selectedRequest, remarks);
      closeDialog();
      setNotice("Registration rejected.");
      await loadRequests();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Unable to reject registration.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <span className="eyebrow">SCERT administration</span>
        <h1>Registration Requests</h1>
        <p>Review pending registrations and activate organisation accounts with their DIET responsibility.</p>
      </header>

      <div className="stat-grid compact-stats">
        <section className="stat-card"><span>Pending</span><strong>{counts.pending}</strong></section>
        <section className="stat-card"><span>Approved</span><strong>{counts.approved}</strong></section>
        <section className="stat-card"><span>Rejected</span><strong>{counts.rejected}</strong></section>
      </div>

      {notice ? <div className="success-banner" role="status">{notice}</div> : null}
      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      <section className="filters approval-filters">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, organisation, email, mobile" /></label>
        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
        <label>Organisation Type<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All</option><option value="diet">DIET</option><option value="pwd">PWD</option><option value="rdp">RDP</option><option value="architecture_department">Architecture Department</option></select></label>
        <label>District<select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}><option value="all">All districts</option>{punjabDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
      </section>

      <section className="table-wrap">
        <div className="section-title"><h2>Approval queue</h2><span>{loading ? "Loading..." : `${filteredRequests.length} requests`}</span></div>
        {loading ? <div className="empty-state">Loading registration requests...</div> : (
          <table>
            <thead><tr><th>Applicant Name</th><th>Organisation</th><th>Organisation Type</th><th>District</th><th>Designation</th><th>Mobile</th><th>Email</th><th>Requested Role</th><th>Submitted Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredRequests.length ? filteredRequests.map((request) => (
                <tr key={request.userId}>
                  <td>{request.contactPersonName}</td>
                  <td>{request.organisationName}</td>
                  <td>{request.organisationRoleLabel}</td>
                  <td>{request.architectureZoneLabel ?? request.districtName ?? "â€”"}</td>
                  <td>{request.designation}</td>
                  <td>{request.mobile}</td>
                  <td>{request.email}</td>
                  <td>{request.requestedSystemRole.replaceAll("_", " ")}</td>
                  <td>{formatDate(request.submittedAt)}</td>
                  <td><span className={`status-pill ${request.status === "approved" ? "completed" : request.status === "pending" ? "in_progress" : "delayed"}`}>{request.status}</span></td>
                  <td><div className="table-actions">
                    <button className="link-button" type="button" onClick={() => openDialog(request, "view")}><Eye size={15} /> View</button>
                    {request.status === "pending" ? (
                      <>
                        <button className="link-button" type="button" onClick={() => openDialog(request, "approve")}><CheckCircle2 size={15} /> Approve</button>
                        <button className="link-button" type="button" onClick={() => openDialog(request, "reject")}><XCircle size={15} /> Reject</button>
                      </>
                    ) : null}
                  </div></td>
                </tr>
              )) : <tr><td colSpan={11}>No registration requests match the current filters.</td></tr>}
            </tbody>
          </table>
        )}
      </section>

      {selectedRequest ? (
        <section className="section-band review-panel">
          <div className="section-title"><h2>{dialogMode === "approve" ? "Approve registration" : dialogMode === "reject" ? "Reject registration" : "Applicant details"}</h2><button className="secondary-button" type="button" onClick={closeDialog}>Close</button></div>
          <div className="detail-grid">
            {selectedRequest.organisationRole === "diet" && <div><span>Registered DIET</span><strong>{diets.find(d => d.id === selectedRequest.registeredDietId)?.name || "Legacy request: verify DIET during approval"}</strong></div>}
            <div><span>Email</span><strong>{selectedRequest.email}</strong></div>
            <div><span>Office address</span><strong>{selectedRequest.officeAddress}</strong></div>
            <div><span>Division</span><strong>{selectedRequest.divisionName || "—"}</strong></div>
            <div><span>Engineering discipline</span><strong>{selectedRequest.engineeringDiscipline || "—"}</strong></div>
            <div><span>Applicant</span><strong>{selectedRequest.contactPersonName}</strong></div>
            <div><span>Organisation</span><strong>{selectedRequest.organisationName}</strong></div>
            <div><span>Type</span><strong>{selectedRequest.organisationRoleLabel}</strong></div>
            <div><span>{selectedRequest.organisationRole === "architecture_department" ? "Zone" : "District"}</span><strong>{selectedRequest.architectureZoneLabel ?? selectedRequest.districtName ?? "â€”"}</strong></div>
          </div>

          {dialogMode === "approve" ? (
            <form className="agency-form review-form" onSubmit={handleApprove}>
              <label>System role<input readOnly value={getRequestedSystemRole(selectedRequest.organisationRole).replaceAll("_", " ")} /></label>
              {selectedRequest.organisationRole === "diet" ? <label>Registered DIET (verify before approval)
                <select required value={assignedDietIds[0] || ""} disabled={Boolean(selectedRequest.registeredDietId)} onChange={e => setAssignedDietIds([e.target.value])}>
                  <option value="">Verify DIET for this legacy registration</option>
                  {diets.filter(d => d.active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label> : <fieldset className="agency-form-wide"><legend>Assigned DIETs *</legend>
                <p>Select the DIET projects this organisation is responsible for.</p>
                {diets.filter(d => d.active !== false).map(d => <label key={d.id} className="checkbox-row"><input type="checkbox" checked={assignedDietIds.includes(d.id)} onChange={() => setAssignedDietIds(ids => ids.includes(d.id) ? ids.filter(id => id !== d.id) : [...ids, d.id])} />{d.name}</label>)}
              </fieldset>}
              <label className="agency-form-wide">Approval remarks<textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
              <div className="form-actions"><button className="primary-button" type="submit" disabled={reviewing}>{reviewing ? "Approving..." : "Approve Registration"}</button></div>
            </form>
          ) : null}

          {dialogMode === "reject" ? (
            <form className="agency-form review-form" onSubmit={handleReject}>
              <label className="agency-form-wide">Rejection reason *<textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
              <div className="form-actions"><button className="primary-button danger-button" type="submit" disabled={reviewing}>{reviewing ? "Rejecting..." : "Reject Registration"}</button></div>
            </form>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
