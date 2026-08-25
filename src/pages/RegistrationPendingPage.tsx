import { Link, useLocation } from "react-router-dom";

type PendingSummary = {
  organisationName?: string;
  organisationRoleLabel?: string;
  districtName?: string;
  status?: string;
};

export function RegistrationPendingPage() {
  const location = useLocation();
  const stored = sessionStorage.getItem("coeRegistrationPending");
  const summary = ((location.state as PendingSummary | null) || (stored ? JSON.parse(stored) : {})) as PendingSummary;

  return (
    <main className="login-screen">
      <section className="login-panel">
        <span className="eyebrow">Registration submitted successfully</span>
        <h1 className="pending-title">Pending SCERT Approval</h1>
        <div className="pending-summary">
          <div><span>Organisation</span><strong>{summary.organisationName || "Submitted organisation"}</strong></div>
          <div><span>Selected role</span><strong>{summary.organisationRoleLabel || "Registration role"}</strong></div>
          <div><span>Selected district</span><strong>{summary.districtName || "Selected district"}</strong></div>
        </div>
        <span className="status-pill in_progress">Pending SCERT Approval</span>
        <p className="muted-text">
          Your registration request has been submitted. You will be able to access the portal after approval by SCERT Punjab.
        </p>
        <div className="split-actions">
          <Link className="secondary-button" to="/login">Return to Login</Link>
          <Link className="primary-button" to="/login">Check Approval Status</Link>
        </div>
      </section>
    </main>
  );
}
