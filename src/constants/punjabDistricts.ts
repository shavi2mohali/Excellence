export type PunjabDistrict = {
  id: string;
  name: string;
};

export const punjabDistricts: PunjabDistrict[] = [
  { id: "amritsar", name: "Amritsar" },
  { id: "barnala", name: "Barnala" },
  { id: "bathinda", name: "Bathinda" },
  { id: "faridkot", name: "Faridkot" },
  { id: "fatehgarh_sahib", name: "Fatehgarh Sahib" },
  { id: "fazilka", name: "Fazilka" },
  { id: "ferozepur", name: "Ferozepur" },
  { id: "gurdaspur", name: "Gurdaspur" },
  { id: "hoshiarpur", name: "Hoshiarpur" },
  { id: "jalandhar", name: "Jalandhar" },
  { id: "kapurthala", name: "Kapurthala" },
  { id: "ludhiana", name: "Ludhiana" },
  { id: "malerkotla", name: "Malerkotla" },
  { id: "mansa", name: "Mansa" },
  { id: "moga", name: "Moga" },
  { id: "pathankot", name: "Pathankot" },
  { id: "patiala", name: "Patiala" },
  { id: "rupnagar", name: "Rupnagar" },
  { id: "sas_nagar", name: "Sahibzada Ajit Singh Nagar" },
  { id: "sangrur", name: "Sangrur" },
  { id: "sbs_nagar", name: "Shaheed Bhagat Singh Nagar" },
  { id: "sri_muktsar_sahib", name: "Sri Muktsar Sahib" },
];

export function getDistrictName(districtId: string) {
  return punjabDistricts.find((district) => district.id === districtId)?.name || "";
}
