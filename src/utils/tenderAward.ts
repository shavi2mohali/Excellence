export function calculateTenderAwardVariance(tenderEstimatedValue:number,finalContractValue:number){
 const difference=finalContractValue-tenderEstimatedValue;
 const percentDifference=tenderEstimatedValue>0?(difference/tenderEstimatedValue)*100:0;
 return{difference,percentDifference,tenderSavingAmount:difference<0?-difference:0,tenderSavingPercent:difference<0?-percentDifference:0,excessAmount:difference>0?difference:0,excessPercent:difference>0?percentDifference:0};
}
export function calculateScheduledCompletionDate(commencementDate:string|Date|undefined,completionPeriodValue:number,unit:"days"|"months"){
 if(!commencementDate||!Number.isFinite(completionPeriodValue)||completionPeriodValue<0)return null;
 const date=new Date(commencementDate);if(Number.isNaN(date.getTime()))return null;
 if(unit==="months"){
  const originalDay=date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth()+completionPeriodValue);
  const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  date.setDate(Math.min(originalDay,lastDay));
 }else date.setDate(date.getDate()+completionPeriodValue);
 return date;
}
