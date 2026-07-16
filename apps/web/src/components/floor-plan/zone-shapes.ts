/**
 * Parametric per-floor layout, keyed "BLD-XXX:floor", geometry traced
 * from the design mock's fpLayouts. Draws exactly the zones present in
 * that floor's occupancy data (the verified matrix: BLD-001 F2 is the
 * only 3-zone floor; every other floor has A and B) — never a zone the
 * data doesn't have. "CORE"/"RECEPTION"/"LOBBY" are decorative,
 * non-interactive architectural strips with no occupancy binding, since
 * there's no seed data for them and inventing numbers would be dishonest.
 */
export interface ZoneRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RoomRect extends ZoneRect {
  readonly label: string;
}

export interface FloorLayout {
  readonly zones: Readonly<Record<string, ZoneRect>>;
  readonly rooms: ReadonlyArray<RoomRect>;
}

export const FLOOR_PLAN_VIEWBOX = { width: 1000, height: 560 };
/** The building shell every layout sits inside. */
export const FLOOR_PLAN_OUTLINE = { x: 30, y: 40, w: 940, h: 500 };

export const FLOOR_LAYOUTS: Record<string, FloorLayout> = {
  "BLD-001:1": {
    zones: {
      "Zone-A": { x: 60, y: 70, w: 470, h: 400 },
      "Zone-B": { x: 620, y: 70, w: 320, h: 400 },
    },
    rooms: [
      { x: 545, y: 70, w: 65, h: 400, label: "CORE" },
      { x: 60, y: 485, w: 880, h: 52, label: "RECEPTION" },
    ],
  },
  "BLD-001:2": {
    zones: {
      "Zone-A": { x: 60, y: 70, w: 400, h: 250 },
      "Zone-B": { x: 540, y: 70, w: 400, h: 250 },
      "Zone-C": { x: 60, y: 335, w: 880, h: 200 },
    },
    rooms: [{ x: 470, y: 70, w: 60, h: 250, label: "CORE" }],
  },
  "BLD-002:1": {
    zones: {
      "Zone-A": { x: 60, y: 70, w: 400, h: 400 },
      "Zone-B": { x: 540, y: 70, w: 400, h: 400 },
    },
    rooms: [
      { x: 470, y: 70, w: 60, h: 400, label: "CORE" },
      { x: 60, y: 485, w: 880, h: 52, label: "LOBBY" },
    ],
  },
  "BLD-002:2": {
    zones: {
      "Zone-A": { x: 60, y: 70, w: 430, h: 400 },
      "Zone-B": { x: 570, y: 70, w: 370, h: 400 },
    },
    rooms: [{ x: 500, y: 70, w: 60, h: 400, label: "CORE" }],
  },
};

export const BUILDING_FLOOR_TABS = [
  { buildingId: "BLD-001", floor: 1, label: "BLD-001 · F1" },
  { buildingId: "BLD-001", floor: 2, label: "BLD-001 · F2" },
  { buildingId: "BLD-002", floor: 1, label: "BLD-002 · F1" },
  { buildingId: "BLD-002", floor: 2, label: "BLD-002 · F2" },
] as const;
