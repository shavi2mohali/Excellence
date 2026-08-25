import { Activity, Building2, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/diets", label: "DIETs", icon: Building2 },
  { to: "/activities", label: "Activities", icon: Activity },
  { to: "/admin", label: "Admin", icon: Settings },
];

export function AppLayout() {
  const { profile, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="emblem">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="department">SCERT Punjab</span>
            <strong>Centre of Excellence</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{profile?.displayName || "Authenticated user"}</span>
            <small>{profile?.role?.replaceAll("_", " ") || "Role pending"}</small>
          </div>
          <button className="icon-text-button" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
