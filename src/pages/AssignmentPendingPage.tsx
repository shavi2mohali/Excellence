import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function AssignmentPendingPage() {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  if (profile?.assignmentStatus === "assigned") return <Navigate to="/" replace />;
  const inactive = profile?.assignmentStatus === "inactive";
  return <main className="login-screen"><section className="login-panel"><div className="brand-lockup large"><div className="emblem"><ShieldCheck size={28}/></div><div><span className="department">SCERT Punjab</span><strong>Organisational assignment</strong></div></div><h1 className="pending-title">{inactive ? "Assignment inactive" : "Assignment pending"}</h1><p>{inactive ? "Your current organisational assignment is inactive. Please contact SCERT Punjab." : "Your account has been approved by SCERT, but your DIET or executing agency assignment is still pending."}</p><div className="pending-summary"><div><span>User name</span><strong>{profile?.name ?? profile?.displayName ?? "—"}</strong></div><div><span>Organisation role</span><strong>{profile?.organisationRole?.toUpperCase() ?? "—"}</strong></div><div><span>District</span><strong>{profile?.districtName ?? "—"}</strong></div><div><span>Approval status</span><strong>Approved</strong></div><div><span>Assignment status</span><strong>{inactive ? "Inactive" : "Pending"}</strong></div></div><p className="muted-text">Please contact SCERT Punjab if you need assistance.</p><div className="split-actions"><button className="primary-button" disabled={checking} onClick={async () => { setChecking(true); try { await refreshProfile(); } finally { setChecking(false); } }}>{checking ? "Checking..." : "Check Assignment Status"}</button><button className="secondary-button" onClick={() => void logout()}>Logout</button></div></section></main>;
}
