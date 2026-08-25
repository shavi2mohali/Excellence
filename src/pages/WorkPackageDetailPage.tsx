import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { getActivityMaster } from "../lib/firestore";
import { getAccessibleWorkPackages } from "../services/accessScopeService";
import { getTendersForWorkPackage } from "../services/tenderService";
import { useAuth } from "../contexts/AuthContext";
import { canCreateTender } from "../utils/tenderPermissions";
import { tenderStatusLabels } from "../constants/tenders";
import { labelWorkCategory, workPackageStatusLabels } from "../constants/projectExecution";
import { formatIndianCurrency } from "../utils/currency";
import { getPackageFinancialBasis } from "../utils/fundingCalculations";
import type { ActivityMaster, Tender, WorkPackage } from "../types";

function displayTimestamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toLocaleString("en-IN");
  return "—";
}

export function WorkPackageDetailPage() {
  const { id = "" } = useParams();
  const { profile, accessScope } = useAuth();
  const [item, setItem] = useState<WorkPackage | null>(null), [activities, setActivities] = useState<ActivityMaster[]>([]), [tenders, setTenders] = useState<Tender[]>([]), [loading, setLoading] = useState(true);
  useEffect(() => { if (!accessScope) return; Promise.all([getAccessibleWorkPackages(accessScope), getActivityMaster()]).then(async ([permitted, master]) => { const data=permitted.find((entry)=>entry.id===id)||null; setItem(data); setActivities(master); setTenders(data?await getTendersForWorkPackage(id):[]); }).finally(() => setLoading(false)); }, [id, accessScope]);
  const selected = useMemo(() => activities.filter((activity) => item?.activityIds?.includes(activity.id)), [activities, item]);
  if (loading) return <div className="empty-state">Loading work package...</div>;
  if (!item) return <><PageHeader title="Access denied" description="You are not authorised to access this work package."/><Link to="/work-packages">Return to Work Packages</Link></>;
  return <><PageHeader eyebrow="Work package detail" title={item.packageTitle} description={item.packageCode}/>
    <section className="section-band"><div className="section-title"><h2>Package Overview</h2><Link to="/work-packages">Back to register</Link></div><div className="detail-grid"><div><span>Code</span><strong>{item.packageCode}</strong></div><div><span>DIET</span><strong>{item.dietName}</strong></div><div><span>Phase</span><strong>{item.phaseName}</strong></div><div><span>Executing Agency</span><strong>{item.executingAgencyName}</strong></div><div><span>Category</span><strong>{labelWorkCategory(item.workCategory)}</strong></div><div><span>Status</span><strong>{workPackageStatusLabels[item.status]}</strong></div></div></section>
    <section className="section-band"><div className="section-title"><h2>Scope</h2></div><p>{item.packageDescription}</p><div className="activity-list">{selected.map((activity) => <div className="activity-row" key={activity.id}><span>{activity.serialNo}</span><strong>{activity.subActivity}</strong><code>{activity.code}</code></div>)}{!selected.length && <p className="muted-text">No activities selected.</p>}</div></section>
    <section className="section-band"><div className="section-title"><h2>Financial Summary</h2></div><div className="detail-grid"><div><span>Estimated Cost</span><strong>{formatIndianCurrency(item.estimatedCost)}</strong></div><div><span>Administrative Approval</span><strong>{formatIndianCurrency(item.administrativeApprovalAmount)}</strong></div><div><span>Technical Sanction</span><strong>{formatIndianCurrency(item.technicalSanctionAmount)}</strong></div><div><span>Current Financial Basis</span><strong>{formatIndianCurrency(getPackageFinancialBasis(item))}</strong></div><div><span>Centre Share 60%</span><strong>{formatIndianCurrency(item.centralShareAmount)}</strong></div><div><span>State Share 40%</span><strong>{formatIndianCurrency(item.stateShareAmount)}</strong></div></div></section>
    <section className="section-band"><div className="section-title"><h2>Award and Work Order</h2>{item.tenderAwardId&&<Link to={"/tender-awards/"+item.tenderAwardId}>View Award</Link>}</div><div className="detail-grid"><div><span>Awarded Contractor</span><strong>{item.contractorName||"—"}</strong></div><div><span>Final Contract Value</span><strong>{formatIndianCurrency(item.finalContractValue||0)}</strong></div><div><span>Work Order</span><strong>{item.workOrderId?<Link to={"/work-orders/"+item.workOrderId}>{item.workOrderNumber}</Link>:"Pending"}</strong></div><div><span>Work Order Status</span><strong>{item.workOrderStatus?.replaceAll("_"," ")||"Not started"}</strong></div></div></section>
    <section className="section-band"><div className="section-title"><h2>Tender / NIT</h2>{item.status === "approved_for_tender" && !tenders.some(t => t.status !== "cancelled" && t.status !== "retender_required") && canCreateTender(profile, item.executingAgencyId) && <Link className="primary-button" to={`/tenders/new?workPackageId=${item.id}`}>Create Tender</Link>}</div>{tenders.length ? <table><thead><tr><th>Tender Number</th><th>Title</th><th>Estimated Value</th><th>Status</th></tr></thead><tbody>{tenders.map(t => <tr key={t.id}><td><Link to={`/tenders/${t.id}`}>{t.tenderNumber || t.nitNumber || "Draft"}</Link></td><td>{t.tenderTitle}</td><td>{formatIndianCurrency(t.estimatedTenderValue)}</td><td>{tenderStatusLabels[t.status]}</td></tr>)}</tbody></table> : <p className="muted-text">No tender has been created for this package.</p>}</section>
    <section className="section-band"><div className="section-title"><h2>Audit Information</h2></div><div className="detail-grid"><div><span>Created by</span><strong>{item.createdBy || "—"}</strong></div><div><span>Created at</span><strong>{displayTimestamp(item.createdAt)}</strong></div><div><span>Updated by</span><strong>{item.updatedBy || "—"}</strong></div><div><span>Updated at</span><strong>{displayTimestamp(item.updatedAt)}</strong></div></div></section>
  </>;
}
