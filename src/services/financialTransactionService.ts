import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { AppUser, DietActivityFinancial, FinancialTransaction, FinancialTransactionType } from "../types";

function context(){if(!db||!auth?.currentUser)throw new Error("Firebase is not configured or the user is not signed in.");return{firestore:db,uid:auth.currentUser.uid};}
const map=(snapshot:{id:string;data():unknown})=>({id:snapshot.id,...snapshot.data() as object}) as FinancialTransaction;

export async function getFinancialTransactions(dietIds?:string[]){
  const{firestore,uid}=context(),profile=await getDoc(doc(firestore,"users",uid)),user=profile.data() as AppUser,role=user.systemRole||user.role;
  if(["scert_admin","scert_viewer","finance_officer","monitoring_officer"].includes(role||"")&&!dietIds?.length)return(await getDocs(collection(firestore,"financialTransactions"))).docs.map(map);
  const ids=dietIds?.length?dietIds:user.assignedDietIds||[];
  const groups=await Promise.all(ids.map(dietId=>getDocs(query(collection(firestore,"financialTransactions"),where("dietId","==",dietId)))));
  return groups.flatMap(group=>group.docs.map(map));
}

export type FinancialTransactionInput={financial:DietActivityFinancial;transactionType:FinancialTransactionType;amount:number;transactionDate:string;agencyId?:string;agencyName?:string;referenceNumber?:string;referenceDate?:string;documentIds?:string[];remarks?:string};
export async function createFinancialTransaction(input:FinancialTransactionInput){
  const{firestore,uid}=context(),profile=await getDoc(doc(firestore,"users",uid)),role=profile.data()?.systemRole||profile.data()?.role;
  if(!["scert_admin","finance_officer"].includes(role))throw new Error("SCERT financial permission is required.");
  if(!Number.isFinite(input.amount)||input.amount<=0||!input.transactionDate)throw new Error("A positive amount and transaction date are required.");
  const principal=input.transactionType==="release_to_principal"||input.transactionType==="principal_expenditure";
  const agency=input.transactionType==="release_to_agency"||input.transactionType==="diet_to_agency_transfer"||input.transactionType==="agency_expenditure";
  if(principal&&input.financial.principalAllocation<=0)throw new Error("This activity has no Principal allocation.");
  if(agency&&input.financial.agencyAllocation<=0)throw new Error("This activity has no Agency allocation.");
  if(agency&&!input.agencyId)throw new Error("Select an executing agency for this transaction.");
  const ref=doc(collection(firestore,"financialTransactions")),record={id:ref.id,dietId:input.financial.dietId,dietName:input.financial.dietName,phaseId:input.financial.phaseId,phaseSequence:input.financial.phaseSequence,activityId:input.financial.activityId||"",activityCode:input.financial.activityCode||"",activityName:input.financial.activityName,transactionType:input.transactionType,amount:input.amount,transactionDate:input.transactionDate,agencyId:input.agencyId||"",agencyName:input.agencyName||"",referenceNumber:input.referenceNumber?.trim()||"",referenceDate:input.referenceDate||"",documentIds:input.documentIds||[],remarks:input.remarks?.trim()||"",createdBy:uid,createdAt:serverTimestamp()},batch=writeBatch(firestore);
  batch.set(ref,record);batch.set(doc(collection(firestore,"auditLogs")),{entityType:"financial_transaction",entityId:ref.id,action:"financial_transaction_created",performedBy:uid,performedAt:serverTimestamp(),previousData:null,newData:record,remarks:record.remarks});await batch.commit();return ref.id;
}
