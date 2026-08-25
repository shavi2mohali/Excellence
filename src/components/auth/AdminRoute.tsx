import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function AdminRoute() {
  const { profile, loading } = useAuth();
  const systemRole = profile?.systemRole || profile?.role;

  if (loading) {
    return <div className="screen-state">Loading secure workspace...</div>;
  }

  if (systemRole !== "scert_admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
