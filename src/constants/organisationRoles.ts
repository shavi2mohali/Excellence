import type { OrganisationRole, SystemRole } from "../types";

export const organisationRoleOptions: { value: OrganisationRole; label: string; requestedSystemRole: SystemRole }[] = [
  {
    value: "diet",
    label: "DIET — District Institute of Education and Training",
    requestedSystemRole: "diet_nodal_officer",
  },
  {
    value: "pwd",
    label: "PWD — Public Works Department",
    requestedSystemRole: "agency_user",
  },
  {
    value: "rdp",
    label: "RDP — Rural Development and Panchayats Department",
    requestedSystemRole: "agency_user",
  },
  {
    value: "architecture_department",
    label: "Department of Architecture, Punjab",
    requestedSystemRole: "architecture_user",
  },
];

export function getOrganisationRoleLabel(role: OrganisationRole) {
  return organisationRoleOptions.find((option) => option.value === role)?.label || role;
}

export function getRequestedSystemRole(role: OrganisationRole): SystemRole {
  return organisationRoleOptions.find((option) => option.value === role)?.requestedSystemRole || "pending_user";
}
