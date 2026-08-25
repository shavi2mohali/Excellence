import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="screen-state">Loading secure workspace...</div>;
  }

  if (
    !firebaseUser
    || !profile
    || !((profile.active === true || profile.isActive === true) && (profile.approvalStatus === "approved" || profile.approved === true))
  ) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const requiresAssignment = ["diet", "pwd", "rdp"].includes(profile.organisationRole ?? "");
  if (requiresAssignment && profile.assignmentStatus !== "assigned" && location.pathname !== "/assignment-pending") {
    return <Navigate to="/assignment-pending" replace />;
  }

  return <Outlet />;
}
