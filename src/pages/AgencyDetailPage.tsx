import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { getAgency } from "../services/agencyService";
import { getAssignmentsForAgency } from "../services/dietAgencyAssignmentService";
import { getWorkPackagesForAgency } from "../services/workPackageService";
import { assignmentStatusLabels, labelScope, labelWorkCategory, workPackageStatusLabels } from "../constants/projectExecution";
import { formatIndianCurrency } from "../utils/currency";
import { getPackageFinancialBasis } from "../utils/fundingCalculations";
import type { Agency, DietAgencyAssignment, WorkPackage } from "../types";

export function AgencyDetailPage() {
  const { agencyId = "" } = useParams();
  const [agency, setAgency] = useState<Agency | null>(null), [assignments, setAssignments] = useState<DietAgencyAssignment[]>([]), [packages, setPackages] = useState<WorkPackage[]>([]), [error, setError] = useState("");
  useEffect(() => { Promise.all([getAgency(agencyId), getAssignmentsForAgency(agencyId), getWorkPackagesForAgency(agencyId)]).then(([agencyData, assignmentData, packageData]) => { setAgency(agencyData); setAssignments(assignmentData); setPackages(packageData); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load agency details.")); }, [agencyId]);
  const count = (id: string) => packages.filter((item) => item.dietAgencyAssignmentId === id).length;
  const total = (id: string) => packages.filter((item) => item.dietAgencyAssignmentId === id).reduce((sum, item) => sum + getPackageFinancialBasis(item), 0);
  return <><PageHeader eyebrow="Executing agency" title={agency?.name || "Agency detail"} description={agency?.type}/>{error && <div className="error-banner">{error}</div>}
    <section className="table-wrap"><div className="section-title"><h2>Assigned DIETs</h2><span>{assignments.length} assignments</span></div><table><thead><tr><th>DIET</th><th>Phase</th><th>District</th><th>Scope</th><th>Assignment Status</th><th>Work Package Count</th><th>Total Package Financial Basis</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><Link to={`/diets/${item.dietId}`}>{item.dietName}</Link></td><td>{item.phaseName}</td><td>{item.districtName}</td><td>{(item.scopeCategories || []).map(labelScope).join(", ")}</td><td>{assignmentStatusLabels[item.status]}</td><td>{count(item.id)}</td><td>{formatIndianCurrency(total(item.id))}</td></tr>)}{!assignments.length && <tr><td colSpan={7}>No DIET assignments available.</td></tr>}</tbody></table></section>
    <section className="table-wrap"><div className="section-title"><h2>Work Packages</h2><span>{packages.length} packages</span></div><table><thead><tr><th>Package Code</th><th>Title</th><th>DIET</th><th>Category</th><th>Financial Basis</th><th>Status</th></tr></thead><tbody>{packages.map((item) => <tr key={item.id}><td><Link to={`/work-packages/${item.id}`}>{item.packageCode}</Link></td><td>{item.packageTitle}</td><td>{item.dietName}</td><td>{labelWorkCategory(item.workCategory)}</td><td>{formatIndianCurrency(getPackageFinancialBasis(item))}</td><td>{workPackageStatusLabels[item.status]}</td></tr>)}{!packages.length && <tr><td colSpan={6}>No work packages available.</td></tr>}</tbody></table></section>
  </>;
}
