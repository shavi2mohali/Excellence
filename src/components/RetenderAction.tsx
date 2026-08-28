import { createRetenderDraft } from "../services/tenderService";
import type { Tender } from "../types";
export function RetenderAction({tender}:{tender:Tender}){async function start(){const reason=prompt("Reason for creating the linked re-tender:")||"";if(!reason)return;try{const id=await createRetenderDraft(tender.id,reason);location.assign(`/tenders/${id}/edit`);}catch(e){alert(e instanceof Error?e.message:"Unable to create re-tender.");}}return tender.status==="retender_required"?<button className="primary-button" onClick={()=>void start()}>Start Re-Tender</button>:null;}
