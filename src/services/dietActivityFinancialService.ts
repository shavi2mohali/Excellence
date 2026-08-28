import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { ActivityMaster, AllocationStatus, AppUser, Diet, DietActivityFinancial } from "../types";

function context(){if(!db||!auth?.currentUser)throw new Error("Firebase is not configured or the user is not signed in.");return{firestore:db,uid:auth.currentUser.uid};}
async function profile(){const{firestore,uid}=context(),snap=await getDoc(doc(firestore,"users",uid));if(!snap.exists())throw new Error("User profile not found.");return{uid,...snap.data()} as AppUser;}
const role=(u:AppUser)=>u.systemRole||u.role;
export function calculateActivityAllocation(effective:number,principal:number,agency:number){const total=principal+agency,unallocated=effective-total,tolerance=.01;let status:AllocationStatus="partially_allocated";if(Math.abs(total)<=tolerance)status="unallocated";else if(total>effective+tolerance)status="over_allocated";else if(Math.abs(total-effective)<=tolerance)status="fully_allocated";return{totalAllocatedAmount:total,unallocatedApprovedAmount:unallocated,allocationStatus:status};}

export async function getDietActivityFinancials(dietIds?:string[]){
 const{firestore}=context(),user=await profile(),r=role(user);
 let items:DietActivityFinancial[];
 if(["scert_admin","scert_viewer","finance_officer","monitoring_officer"].includes(r||"")&&!dietIds?.length)items=(await getDocs(collection(firestore,"dietActivityFinancials"))).docs.map(s=>({id:s.id,...s.data()} as DietActivityFinancial));
 else {
 const ids=dietIds?.length?dietIds:(user.assignedDietIds?.length?user.assignedDietIds:[user.primaryDietId||"__none__"]),groups=await Promise.all(ids.map(dietId=>getDocs(query(collection(firestore,"dietActivityFinancials"),where("dietId","==",dietId)))));
 items=[...new Map(groups.flatMap(s=>s.docs.map(x=>({id:x.id,...x.data()} as DietActivityFinancial))).map(x=>[x.id,x])).values()];
 }
 const dietSet=new Set(items.map(x=>x.dietId)),packageGroups=await Promise.all([...dietSet].map(dietId=>getDocs(query(collection(firestore,"workPackages"),where("dietId","==",dietId))))),committed=new Map<string,number>();for(const s of packageGroups.flatMap(x=>x.docs)){if(s.data().status==="cancelled")continue;for(const a of(s.data().activityAllocations||[]) as {activityId:string;packageAllocatedAmount:number}[])committed.set(`${s.data().dietId}_${a.activityId}`,(committed.get(`${s.data().dietId}_${a.activityId}`)||0)+Number(a.packageAllocatedAmount||0));}return items.map(x=>{const amount=committed.get(`${x.dietId}_${x.activityId}`)||0;return{...x,committedToWorkPackages:amount,availableForNewWorkPackages:Math.max(0,x.agencyAllocation-amount)};});
}
export type ActivityFinancialAvailability={financial:DietActivityFinancial;committedAmount:number;availableAmount:number};
export async function getDietActivityFinancialAvailability(dietId:string,excludePackageId?:string):Promise<ActivityFinancialAvailability[]> {
 const{firestore}=context();
 const[financials,packages]=await Promise.all([
  getDietActivityFinancials([dietId]),
  getDocs(query(collection(firestore,"workPackages"),where("dietId","==",dietId))),
 ]);
 const committed=new Map<string,number>();
 for(const snapshot of packages.docs){
  if(snapshot.id===excludePackageId||snapshot.data().status==="cancelled")continue;
  for(const allocation of(snapshot.data().activityAllocations||[]) as {activityId:string;packageAllocatedAmount:number}[])
   committed.set(allocation.activityId,(committed.get(allocation.activityId)||0)+Number(allocation.packageAllocatedAmount||0));
 }
 return financials.filter(item=>item.active!==false).map(financial=>{const committedAmount=committed.get(financial.activityId||"")||0;return{financial,committedAmount,availableAmount:Math.max(0,financial.agencyAllocation-committedAmount)};});
}
export type FinancialBaselineInput={diet:Diet;activity?:ActivityMaster;activityName:string;activityCode?:string;financialYear:string;approvedPhysical?:number|string;approvedUnitCost?:number;originalApprovedAmount:number;principalAllocation:number;agencyAllocation:number;approvalRemarks?:string;sourceReference?:string;executingAgencyIds?:string[];correctionReason?:string;};
export async function saveDietActivityFinancial(input:FinancialBaselineInput,existingId?:string){
 for(const amount of[input.originalApprovedAmount,input.principalAllocation,input.agencyAllocation])if(!Number.isFinite(amount)||amount<0)throw new Error("Approved amount and allocations must be valid non-negative rupee values.");
 if(!input.activityName.trim()||!input.financialYear.trim())throw new Error("Activity and financial year are required.");
 const{firestore,uid}=context(),user=await profile();if(role(user)!=="scert_admin")throw new Error("SCERT Admin permission is required.");
 const old=existingId?await getDoc(doc(firestore,"dietActivityFinancials",existingId)):null;
 if(old?.exists()&&old.data().originalApprovedAmount!==input.originalApprovedAmount&&!input.correctionReason?.trim())throw new Error("Correction reason is required to change the original approved amount.");
 const oldData=old?.exists()?old.data():null,currentEffective=oldData&&Number(oldData.currentEffectiveApprovedAmount)!==Number(oldData.originalApprovedAmount)?Number(oldData.currentEffectiveApprovedAmount):input.originalApprovedAmount,calculated=calculateActivityAllocation(currentEffective,input.principalAllocation,input.agencyAllocation);
 if(calculated.allocationStatus==="over_allocated")throw new Error("Principal and Agency allocations cannot exceed the current effective approved amount.");
 const unmatchedKey=input.activityName.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")||"unmatched",stable=`${input.diet.id}_${input.activity?.id||input.activityCode?.trim()||unmatchedKey}_${input.financialYear.replace(/[^0-9]/g,"")}_v1`,ref=doc(firestore,"dietActivityFinancials",existingId||stable);
 const record={id:ref.id,dietId:input.diet.id,dietName:input.diet.name,phaseId:input.diet.phaseId,phaseName:input.diet.phaseName||input.diet.phaseYear,financialYear:input.financialYear.trim(),activityId:input.activity?.id||"",activityCode:input.activity?.code||input.activityCode?.trim()||"",activityName:input.activity?.subActivity||input.activityName.trim(),activityLinkStatus:input.activity?"matched":"unmatched",approvedPhysical:input.approvedPhysical??"",approvedUnitCost:Number(input.approvedUnitCost||0),originalApprovedAmount:input.originalApprovedAmount,currentEffectiveApprovedAmount:currentEffective,principalAllocation:input.principalAllocation,agencyAllocation:input.agencyAllocation,...calculated,approvalRemarks:input.approvalRemarks?.trim()||"",sourceType:"manual",sourceReference:input.sourceReference?.trim()||"",approvalVersion:"v1",executingAgencyIds:input.executingAgencyIds||[],active:true,createdBy:old?.exists()?old.data().createdBy:uid,createdAt:old?.exists()?old.data().createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()};
 const previous=old?.exists()?old.data():null,action=!previous?"activity_financial_baseline_created":previous.originalApprovedAmount!==record.originalApprovedAmount?"approved_amount_corrected":previous.activityId!==record.activityId?"activity_link_corrected":previous.principalAllocation!==record.principalAllocation?"principal_allocation_changed":"agency_allocation_changed",batch=writeBatch(firestore);
 batch.set(ref,record);batch.set(doc(collection(firestore,"auditLogs")),{entityType:"diet_activity_financial",entityId:ref.id,action,performedBy:uid,performedAt:serverTimestamp(),previousData:previous,newData:record,remarks:input.correctionReason?.trim()||input.approvalRemarks?.trim()||""});await batch.commit();return ref.id;
}
