import { ScopePhaseProvider, useScopePhases } from "./contexts/ScopePhaseContext";
import { NavLink, Route, Routes } from "react-router-dom";
import { Activity, Building2, CircleDollarSign, ClipboardList, FileText, HardHat, Landmark, LayoutDashboard, LogIn, LogOut, Package, Settings, ShieldCheck, UserRoundCog } from "lucide-react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegistrationPendingPage } from "./pages/RegistrationPendingPage";
import { RegistrationRequestsPage } from "./pages/RegistrationRequestsPage";
import { UserAssignmentsPage } from "./pages/UserAssignmentsPage";
import { AssignmentPendingPage } from "./pages/AssignmentPendingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DietListPage } from "./pages/DietListPage";
import { DietDetailPage } from "./pages/DietDetailPage";
import { CivilAgenciesPage } from "./pages/CivilAgenciesPage";
import { AgencyDetailPage } from "./pages/AgencyDetailPage";
import { ActivityMasterPage } from "./pages/ActivityMasterPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { ActivityFinancialsPage } from "./pages/ActivityFinancialsPage";
import { FinancialTransactionsPage } from "./pages/FinancialTransactionsPage";
import { WorkPackagesPage } from "./pages/WorkPackagesPage";
import { WorkPackageDetailPage } from "./pages/WorkPackageDetailPage";
import { ContractorsPage } from "./pages/ContractorsPage";
import { ContractorFormPage } from "./pages/ContractorFormPage";
import { ContractorDetailPage } from "./pages/ContractorDetailPage";
import { ScopesPage } from "./pages/ScopesPage";
import { TendersPage } from "./pages/TendersPage";
import { TenderFormPage } from "./pages/TenderFormPage";
import { TenderDetailPage } from "./pages/TenderDetailPage";
import { TenderBidsPage } from "./pages/TenderBidsPage";
import { ComparativeStatementPage, FinancialEvaluationPage } from "./pages/FinancialEvaluationPage";
import { AwardRecommendationPage } from "./pages/AwardRecommendationPage";
import { TenderAwardDetailPage } from "./pages/TenderAwardDetailPage";
import { WorkOrderDetailPage } from "./pages/WorkOrderDetailPage";
import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import "./styles.css";

const baseNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/diets", label: "DIETs", icon: Building2 },
  { to: "/agencies", label: "Civil Agencies", icon: Landmark },
  { to: "/contractors", label: "Contractors", icon: HardHat },
  { to: "/scopes", label: "Scope of Work", icon: ClipboardList },
  { to: "/work-packages", label: "Work Packages", icon: Package },
  { to: "/tenders", label: "Tenders / NIT", icon: FileText },
  { to: "/activities", label: "Activities", icon: Activity },
];
const adminNavItems = [
  { to: "/settings", label: "System", icon: Settings },
  { to: "/admin/activity-financials", label: "Activity Financial Approvals", icon: CircleDollarSign },
  { to: "/admin/financial-transactions", label: "Financial Transactions", icon: CircleDollarSign },
  { to: "/admin/registration-requests", label: "Registration Requests", icon: ShieldCheck },
  { to: "/admin/user-assignments", label: "User Assignments", icon: UserRoundCog },
  { to: "/admin/scope-reviews", label: "Scope Reviews", icon: ClipboardList },
];

function PortalLayout() {
  const { firebaseUser, profile, logout } = useAuth();
  const { showNavigation, contextDietId } = useScopePhases();
  const systemRole = profile?.systemRole || profile?.role;
  const restrictedNav = systemRole === "diet_nodal_officer"
    ? [baseNavItems[0], { ...baseNavItems[1], label: "My DIET" }, baseNavItems[2], baseNavItems[4], baseNavItems[5], baseNavItems[6], baseNavItems[3]]
    : systemRole === "architecture_user"
      ? [baseNavItems[0], baseNavItems[4]]
    : systemRole === "agency_user"
      ? [baseNavItems[0], baseNavItems[1], baseNavItems[2], baseNavItems[3], baseNavItems[4], baseNavItems[5], baseNavItems[6]]
      : baseNavItems;
  const navItems = systemRole === "scert_admin" ? [baseNavItems[0], ...adminNavItems, ...baseNavItems.slice(1)] : restrictedNav;
  return <div className="app-shell"><aside className="sidebar"><div className="brand-lockup"><div className="emblem"><ShieldCheck size={24}/></div><div><span className="department">SCERT Punjab</span><strong>Centre of Excellence</strong></div></div>
    <nav className="nav-list" aria-label="Main navigation">{navItems.filter(item => !["/scopes", "/admin/scope-reviews"].includes(item.to) || showNavigation).map((item) => <NavLink key={item.to} to={["/scopes", "/admin/scope-reviews"].includes(item.to) && contextDietId ? `${item.to}?dietId=${encodeURIComponent(contextDietId)}` : item.to} end={item.to === "/"} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><item.icon size={18}/><span>{item.label}</span></NavLink>)}</nav>
    <div className="sidebar-footer">{firebaseUser ? <><div className="user-chip"><span>{profile?.displayName || profile?.name || firebaseUser.email || "Authenticated user"}</span><small>{systemRole?.replaceAll("_", " ") || "Profile pending"}</small></div><button className="icon-text-button" onClick={() => void logout()}><LogOut size={17}/> Sign out</button></> : <NavLink className="icon-text-button" to="/login"><LogIn size={17}/> Sign in</NavLink>}</div>
  </aside><main className="content-area"><Routes>
    <Route path="/" element={<DashboardPage/>}/><Route path="/diets" element={<DietListPage/>}/><Route path="/diets/:dietId" element={<DietDetailPage/>}/>
    <Route path="/agencies" element={<CivilAgenciesPage/>}/><Route path="/agencies/:agencyId" element={<AgencyDetailPage/>}/>
    <Route path="/contractors" element={<ContractorsPage/>}/><Route path="/contractors/new" element={<ContractorFormPage/>}/><Route path="/contractors/:id/edit" element={<ContractorFormPage/>}/><Route path="/contractors/:id" element={<ContractorDetailPage/>}/>
    <Route path="/scopes" element={<ScopesPage/>}/><Route path="/scopes/:scopeId" element={<ScopesPage/>}/>
    <Route path="/work-packages" element={<WorkPackagesPage/>}/><Route path="/work-packages/:id" element={<WorkPackageDetailPage/>}/>
    <Route path="/tenders" element={<TendersPage/>}/><Route path="/tenders/new" element={<TenderFormPage/>}/><Route path="/tenders/:id/edit" element={<TenderFormPage/>}/><Route path="/tenders/:tenderId/bids" element={<TenderBidsPage/>}/><Route path="/tenders/:tenderId/technical-evaluation" element={<TenderBidsPage/>}/><Route path="/tenders/:tenderId/financial-evaluation" element={<FinancialEvaluationPage/>}/><Route path="/tenders/:tenderId/comparative-statement" element={<ComparativeStatementPage/>}/><Route path="/tenders/:tenderId/award-recommendation" element={<AwardRecommendationPage/>}/><Route path="/tenders/:id" element={<TenderDetailPage/>}/>
    <Route path="/tender-awards/:id" element={<TenderAwardDetailPage/>}/><Route path="/work-orders/:id" element={<WorkOrderDetailPage/>}/>
    <Route path="/activities" element={<ActivityMasterPage/>}/>
    <Route element={<AdminRoute/>}><Route path="/settings" element={<AdminSettingsPage/>}/><Route path="/admin/activity-financials" element={<ActivityFinancialsPage/>}/><Route path="/admin/financial-transactions" element={<FinancialTransactionsPage/>}/><Route path="/admin/registration-requests" element={<RegistrationRequestsPage/>}/><Route path="/admin/user-assignments" element={<UserAssignmentsPage/>}/><Route path="/admin/scope-reviews" element={<ScopesPage/>}/></Route>
  </Routes></main></div>;
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/registration-pending" element={<RegistrationPendingPage/>}/><Route element={<ProtectedRoute/>}><Route path="/assignment-pending" element={<AssignmentPendingPage/>}/><Route path="/*" element={<ScopePhaseProvider><PortalLayout/></ScopePhaseProvider>}/></Route></Routes>;
}
