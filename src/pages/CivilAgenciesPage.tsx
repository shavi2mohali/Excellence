import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { agencyTypeOptions } from "../data/agencies";
import {
  createAgency,
  getAgencies,
  getAgency,
  normaliseAgencyName,
  toggleAgencyStatus,
  updateAgency,
  type AgencyInput,
} from "../services/agencyService";
import { getAccessibleAssignments } from "../services/accessScopeService";
import type { Agency, AgencyType } from "../types";

const emptyForm: AgencyInput = {
  name: "",
  type: "PWD",
  contactPersonName: "",
  contactPersonMobile: "",
  contactPersonEmail: "",
  address: "",
  active: true,
};

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function CivilAgenciesPage() {
  const { firebaseUser, profile, accessScope, loading: authLoading } = useAuth();
  const systemRole = profile?.systemRole || profile?.role;
  const canManage = Boolean(
    firebaseUser
    && (profile?.active || profile?.isActive)
    && (profile?.approvalStatus === "approved" || profile?.approved)
    && systemRole === "scert_admin"
  );
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [editingAgencyId, setEditingAgencyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AgencyInput>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAgencies() {
    setLoading(true);
    setError("");
    try {
      if (!accessScope) return;
      if (accessScope.accessType === "global") setAgencies(await getAgencies());
      else if (accessScope.accessType === "agency") setAgencies((await Promise.all((accessScope.agencyIds || []).map(getAgency))).filter((item): item is Agency => Boolean(item)));
      else {
        const assigned = await getAccessibleAssignments(accessScope);
        setAgencies([...new Map(assigned.map((item) => [item.executingAgencyId, { id: item.executingAgencyId, name: item.executingAgencyName, type: item.executingAgencyType as AgencyType, active: item.status === "active" } as Agency])).values()]);
      }
    } catch (loadError) {
      setAgencies([]);
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accessScope) void loadAgencies();
  }, [accessScope]);

  const filteredAgencies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agencies.filter((agency) => {
      const searchable = [
        agency.name,
        agency.type,
        agency.contactPersonName,
        agency.contactPersonMobile,
        agency.contactPersonEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? agency.active : !agency.active);
      return (!term || searchable.includes(term)) && matchesStatus && (typeFilter === "all" || agency.type === typeFilter);
    });
  }, [agencies, search, statusFilter, typeFilter]);

  function validate() {
    const nextErrors: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) nextErrors.name = "Agency name is required.";
    if (!form.type) nextErrors.type = "Agency type is required.";
    if (form.contactPersonMobile?.trim() && !/^\d{10}$/.test(form.contactPersonMobile.trim())) {
      nextErrors.contactPersonMobile = "Mobile number must contain exactly 10 digits.";
    }
    if (form.contactPersonEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactPersonEmail.trim())) {
      nextErrors.contactPersonEmail = "Enter a valid email address.";
    }
    if (
      name &&
      agencies.some(
        (agency) => agency.id !== editingAgencyId && normaliseAgencyName(agency.name) === normaliseAgencyName(name),
      )
    ) {
      nextErrors.name = "An agency with this name already exists.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!canManage) {
      setError("You must be signed in as an active SCERT administrator to manage agencies.");
      return;
    }
    if (!validate()) return;

    const payload: AgencyInput = {
      ...form,
      name: form.name.trim(),
      contactPersonName: form.contactPersonName?.trim(),
      contactPersonMobile: form.contactPersonMobile?.trim(),
      contactPersonEmail: form.contactPersonEmail?.trim(),
      address: form.address?.trim(),
    };

    setSaving(true);
    try {
      await (editingAgencyId ? updateAgency(editingAgencyId, payload) : createAgency(payload));
      const successMessage = editingAgencyId ? "Agency updated successfully." : "Agency added successfully.";
      closeForm();
      await loadAgencies();
      setNotice(successMessage);
    } catch (saveError) {
      setError(readableError(saveError));
    } finally {
      setSaving(false);
    }
  }

  function openAddForm() {
    setEditingAgencyId(null);
    setForm(emptyForm);
    setErrors({});
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(agency: Agency) {
    setEditingAgencyId(agency.id);
    setForm({
      name: agency.name,
      type: agency.type,
      contactPersonName: agency.contactPersonName ?? "",
      contactPersonMobile: agency.contactPersonMobile ?? "",
      contactPersonEmail: agency.contactPersonEmail ?? "",
      address: agency.address ?? "",
      active: agency.active,
    });
    setErrors({});
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAgencyId(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleToggle(agency: Agency) {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await toggleAgencyStatus(agency);
      await loadAgencies();
      setNotice(`${agency.name} ${agency.active ? "deactivated" : "activated"} successfully.`);
    } catch (toggleError) {
      setError(readableError(toggleError));
    }
  }

  return (
    <>
      <header className="page-header page-header-actions">
        <div>
          <span className="eyebrow">Civil works master</span>
          <h1>Civil Agencies</h1>
          <p>Maintain executing agencies for later assignment to individual DIETs.</p>
        </div>
        {canManage ? (
          <button className="primary-button" type="button" onClick={openAddForm}>
            <Plus size={18} /> Add Agency
          </button>
        ) : null}
      </header>

      {!authLoading && !canManage ? (
        <div className="notice-banner">
          {firebaseUser
            ? "You have read-only access. Only an active SCERT administrator can manage agencies."
            : "Sign in as an SCERT administrator to add or edit agencies. Read-only access depends on Firestore permissions."}
        </div>
      ) : null}
      {notice ? <div className="success-banner" role="status">{notice}</div> : null}
      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      {formOpen && canManage ? (
        <section className="section-band">
          <div className="section-title">
            <h2>{editingAgencyId ? "Edit agency" : "Add agency"}</h2>
            <button className="secondary-button" type="button" onClick={closeForm}>
              <X size={17} /> Close
            </button>
          </div>
          <form className="agency-form" onSubmit={handleSubmit} noValidate>
            <label>
              Agency Name *
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </label>
            <label>
              Agency Type *
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AgencyType })}>
                {agencyTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {errors.type ? <span className="field-error">{errors.type}</span> : null}
            </label>
            <label>
              Contact Person Name
              <input value={form.contactPersonName} onChange={(event) => setForm({ ...form, contactPersonName: event.target.value })} />
            </label>
            <label>
              Contact Person Mobile
              <input inputMode="numeric" maxLength={10} value={form.contactPersonMobile} onChange={(event) => setForm({ ...form, contactPersonMobile: event.target.value })} />
              {errors.contactPersonMobile ? <span className="field-error">{errors.contactPersonMobile}</span> : null}
            </label>
            <label>
              Contact Person Email
              <input type="email" value={form.contactPersonEmail} onChange={(event) => setForm({ ...form, contactPersonEmail: event.target.value })} />
              {errors.contactPersonEmail ? <span className="field-error">{errors.contactPersonEmail}</span> : null}
            </label>
            <label className="agency-form-wide">
              Address
              <textarea rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Active
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingAgencyId ? "Update Agency" : "Add Agency"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="filters agency-filters" aria-label="Agency filters">
        <label>
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, type, contact, mobile, or email" />
        </label>
        <label>
          Agency Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {agencyTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </section>

      <section className="table-wrap">
        <div className="section-title">
          <h2>Agency list</h2>
          <span>{loading ? "Loading..." : `${filteredAgencies.length} ${filteredAgencies.length === 1 ? "agency" : "agencies"}`}</span>
        </div>
        {loading ? (
          <div className="empty-state">Loading agencies...</div>
        ) : filteredAgencies.length === 0 ? (
          <div className="empty-state">No agencies match the current search and filters.</div>
        ) : (
          <table>
            <thead><tr><th>Agency Name</th><th>Type</th><th>Contact Person</th><th>Mobile</th><th>Email</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr></thead>
            <tbody>
              {filteredAgencies.map((agency) => (
                <tr key={agency.id}>
                  <td><Link to={`/agencies/${agency.id}`}>{agency.name}</Link></td>
                  <td><span className="type-badge">{agency.type}</span></td>
                  <td>{agency.contactPersonName || "—"}</td>
                  <td>{agency.contactPersonMobile || "—"}</td>
                  <td>{agency.contactPersonEmail || "—"}</td>
                  <td><span className={`status-pill ${agency.active ? "completed" : "delayed"}`}>{agency.active ? "Active" : "Inactive"}</span></td>
                  {canManage ? (
                    <td><div className="table-actions">
                      <button className="link-button" type="button" onClick={() => openEditForm(agency)}>Edit</button>
                      <button className="link-button" type="button" onClick={() => void handleToggle(agency)}>{agency.active ? "Deactivate" : "Activate"}</button>
                    </div></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
