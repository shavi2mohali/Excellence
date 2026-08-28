import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, getFirebaseConfigurationMessage } from "../lib/firebase";
import type { DocumentAttachment } from "../types";

const MAX_PDF_SIZE=15*1024*1024;
function context(){if(!db)throw new Error(getFirebaseConfigurationMessage());if(!auth?.currentUser)throw new Error("You must be signed in.");return{firestore:db,user:auth.currentUser};}
export async function uploadPdfAttachment(file:File,metadata:{entityType:string;entityId:string;documentType:string;revision?:string}){
 if(file.type!=="application/pdf")throw new Error("Only PDF attachments are permitted.");if(file.size<=0||file.size>MAX_PDF_SIZE)throw new Error("PDF attachments must be no larger than 15 MB.");
 const{firestore,user}=context(),endpoint=import.meta.env.VITE_R2_UPLOAD_ENDPOINT?.trim();if(!endpoint)throw new Error("The secure R2 upload endpoint is not configured. Contact the system administrator.");
 const token=await user.getIdToken(),form=new FormData();form.append("file",file);Object.entries(metadata).forEach(([key,value])=>value&&form.append(key,value));
 const response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||"PDF upload failed.");const uploaded=await response.json() as {id:string;storageKey:string;downloadUrl?:string};
 const record:DocumentAttachment={id:uploaded.id,originalFileName:file.name,mimeType:"application/pdf",size:file.size,storageKey:uploaded.storageKey,uploadedBy:user.uid,uploadedAt:serverTimestamp(),entityType:metadata.entityType,entityId:metadata.entityId,documentType:metadata.documentType,revision:metadata.revision,downloadUrl:uploaded.downloadUrl};await setDoc(doc(firestore,"documentAttachments",record.id),record);return record;
}
export async function getAttachments(entityType:string,entityId:string){const{firestore}=context();return(await getDocs(query(collection(firestore,"documentAttachments"),where("entityType","==",entityType),where("entityId","==",entityId)))).docs.map(x=>({id:x.id,...x.data()} as DocumentAttachment));}
export async function getAttachment(id:string){const{firestore}=context(),snap=await getDoc(doc(firestore,"documentAttachments",id));return snap.exists()?({id:snap.id,...snap.data()} as DocumentAttachment):null;}
