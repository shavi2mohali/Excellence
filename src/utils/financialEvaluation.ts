import type { TenderFinancialBid } from "../types";

export function calculateAboveBelowEstimate(estimate: number, evaluatedAmount: number) {
  const difference = evaluatedAmount - estimate;
  return { difference, percentDifference: estimate > 0 ? (difference / estimate) * 100 : 0 };
}

export function formatAboveBelowEstimate(percent: number) {
  if (Math.abs(percent) < 0.005) return "At Estimate";
  return `${Math.abs(percent).toFixed(2)}% ${percent < 0 ? "Below" : "Above"} Estimate`;
}

export function rankFinancialBids(items: TenderFinancialBid[]) {
  const sorted = [...items].sort((a,b)=>a.finalEvaluatedAmount-b.finalEvaluatedAmount);
  const lowest = sorted[0]?.finalEvaluatedAmount;
  const jointLowest = sorted.filter(x=>x.finalEvaluatedAmount===lowest).length>1;
  return sorted.map((item,index)=>{
    const firstAtAmount=sorted.findIndex(x=>x.finalEvaluatedAmount===item.finalEvaluatedAmount);
    const rank=firstAtAmount+1;
    return {...item,comparisonPosition:index+1,rank,isL1:rank===1&&!jointLowest,isL2:rank===2,isL3:rank===3,isJointLowest:jointLowest&&item.finalEvaluatedAmount===lowest};
  });
}
