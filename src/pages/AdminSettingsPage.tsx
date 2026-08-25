import { PageHeader } from "../components/PageHeader";

const roles = ["scert_admin", "scert_viewer", "diet_nodal_officer", "agency_user", "finance_officer", "monitoring_officer"];

export function AdminSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings and master data" description="Placeholder area for user management, assignments, agency master, and future configuration screens." />

      <section className="section-band">
        <div className="section-title">
          <h2>Configured user roles</h2>
          <span>Foundation access model</span>
        </div>
        <div className="role-grid">
          {roles.map((role) => (
            <article className="role-card" key={role}>
              <strong>{role.replaceAll("_", " ")}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
