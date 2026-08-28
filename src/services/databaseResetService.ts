import { auth } from "../lib/firebase";
export type ResetPreview={enabled:boolean;deleted:Record<string,number>;preserved:Record<string,number>};
const endpoint=String(import.meta.env.VITE_DATABASE_RESET_ENDPOINT||"").trim();
async function request(method:"GET"|"POST",body?:unknown){if(!endpoint)throw new Error("Database reset backend is not configured.");if(!auth?.currentUser)throw new Error("Authentication required.");const token=await auth.currentUser.getIdToken(true),response=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined}),data=await response.json().catch(()=>({error:"Invalid server response."}));if(!response.ok)throw new Error(data.error||"Database reset request failed.");return data;}
export const getDatabaseResetPreview=()=>request("GET") as Promise<ResetPreview>;
export const resetApplicationData=()=>request("POST",{confirmation:"RESET DATABASE"}) as Promise<{status:string;deleted:Record<string,number>;preserved:Record<string,number>;errors:string[]}>;
