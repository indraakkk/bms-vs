/**
 * Parametric per-floor room layout, keyed "BLD-XXX:floor". Draws exactly
 * the zones present in that floor's occupancy data (the verified matrix:
 * BLD-001 F2 is the only 3-zone floor; every other floor has A and B) —
 * never a zone the data doesn't have. Room labels (Open Workspace,
 * Meeting Room, Server Room) are cosmetic flavor for the real zones;
 * "Reception" is a decorative, non-interactive strip near the entrance
 * with no occupancy binding, since there's no seed data for a lobby zone
 * and inventing numbers for it would be dishonest.
 */
export interface ZoneRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly roomLabel: string;
}

export const FLOOR_PLAN_VIEWBOX = { width: 420, height: 300 };

const TWO_ZONE_LAYOUT: Record<string, ZoneRect> = {
  "Zone-A": { x: 20, y: 50, w: 240, h: 230, roomLabel: "Open Workspace" },
  "Zone-B": { x: 280, y: 50, w: 120, h: 230, roomLabel: "Meeting Room" },
};

const THREE_ZONE_LAYOUT: Record<string, ZoneRect> = {
  "Zone-A": { x: 20, y: 50, w: 240, h: 230, roomLabel: "Open Workspace" },
  "Zone-B": { x: 280, y: 50, w: 120, h: 105, roomLabel: "Meeting Room" },
  "Zone-C": { x: 280, y: 175, w: 120, h: 105, roomLabel: "Server Room" },
};

export const ZONE_SHAPES: Record<string, Record<string, ZoneRect>> = {
  "BLD-001:1": TWO_ZONE_LAYOUT,
  "BLD-001:2": THREE_ZONE_LAYOUT,
  "BLD-002:1": TWO_ZONE_LAYOUT,
  "BLD-002:2": TWO_ZONE_LAYOUT,
};

export const BUILDING_FLOOR_TABS = [
  { buildingId: "BLD-001", floor: 1, label: "BLD-001 · Floor 1" },
  { buildingId: "BLD-001", floor: 2, label: "BLD-001 · Floor 2" },
  { buildingId: "BLD-002", floor: 1, label: "BLD-002 · Floor 1" },
  { buildingId: "BLD-002", floor: 2, label: "BLD-002 · Floor 2" },
] as const;
