export type ArchitectureZone = "north" | "south" | "east" | "west";

export const architectureZones: { value: ArchitectureZone; label: string }[] = [
  { value: "north", label: "North Zone" },
  { value: "south", label: "South Zone" },
  { value: "east", label: "East Zone" },
  { value: "west", label: "West Zone" },
];

export function getArchitectureZoneLabel(zone?: string) {
  return architectureZones.find((item) => item.value === zone)?.label ?? "";
}
