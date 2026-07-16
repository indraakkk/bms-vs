import type { CardConfig, CardType, DashboardCard, GridLayoutItem } from "@bms/contract";
import { verticalCompactor } from "react-grid-layout";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARD_DEFAULT_SIZE, defaultCardTitle } from "@/lib/card-defaults";
import { buildSampleDashboard } from "@/lib/sample-dashboard";

const GRID_COLS = 12;

// GridLayoutItem (contract) and RGL's LayoutItem are structurally
// identical ({i,x,y,w,h}) — just two independently-declared types.
function compact(layout: GridLayoutItem[]): GridLayoutItem[] {
  return verticalCompactor.compact(
    layout as unknown as Parameters<typeof verticalCompactor.compact>[0],
    GRID_COLS,
  ) as unknown as GridLayoutItem[];
}

/** Every card gets a layout slot: imported layouts may omit (or misname)
 *  entries, so orphaned cards are appended at the bottom and compacted. */
function reconcileLayout(
  cards: ReadonlyArray<DashboardCard>,
  layout: ReadonlyArray<GridLayoutItem>,
): GridLayoutItem[] {
  const byId = new Map(layout.map((l) => [l.i, l]));
  let bottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const next = cards.map((card) => {
    const existing = byId.get(card.id);
    if (existing) return existing;
    const size = CARD_DEFAULT_SIZE[card.cardType];
    return { i: card.id, x: 0, y: bottom++, w: size.w, h: size.h };
  });
  return compact(next);
}

/** Content equality on the contract's fields only — RGL decorates items
 *  with ephemera (`moved`, drag flags) that must not count as change. */
function sameLayout(
  a: ReadonlyArray<GridLayoutItem>,
  b: ReadonlyArray<GridLayoutItem>,
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((l) => [l.i, l]));
  return a.every((l) => {
    const m = byId.get(l.i);
    return m !== undefined && m.x === l.x && m.y === l.y && m.w === l.w && m.h === l.h;
  });
}

interface DashboardStoreState {
  cards: DashboardCard[];
  layout: GridLayoutItem[];
  /** Transient — not persisted. Which palette tile is being dragged, for the RGL ghost placeholder. */
  draggingCardType: CardType | null;
  /** Returns the new card's id so callers can open its config modal immediately. */
  addCard: (cardType: CardType, position?: { x: number; y: number }) => string;
  duplicateCard: (id: string) => void;
  updateCard: (id: string, title: string, config: CardConfig) => void;
  removeCard: (id: string) => void;
  clearAll: () => void;
  /** Wholesale replace (layout import / sample dashboard). */
  replaceState: (cards: ReadonlyArray<DashboardCard>, layout: ReadonlyArray<GridLayoutItem>) => void;
  loadSample: () => void;
  setLayout: (layout: GridLayoutItem[]) => void;
  setDraggingCardType: (cardType: CardType | null) => void;
}

export const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set, get) => ({
      cards: [],
      layout: [],
      draggingCardType: null,

      addCard: (cardType, position) => {
        const id = crypto.randomUUID();
        const size = CARD_DEFAULT_SIZE[cardType];
        set((state) => {
          // Bottom of the current layout — a safe starting point the
          // compactor below will pull up into the first open slot.
          const bottom = state.layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
          const layout = compact([
            ...state.layout,
            {
              i: id,
              x: position?.x ?? 0,
              y: position?.y ?? bottom,
              w: size.w,
              h: size.h,
            },
          ]);
          return {
            cards: [
              ...state.cards,
              { id, cardType, title: defaultCardTitle(cardType), config: null },
            ],
            layout,
          };
        });
        return id;
      },

      duplicateCard: (id) => {
        const { cards, layout } = get();
        const source = cards.find((c) => c.id === id);
        if (!source) return;
        const sourceLayout = layout.find((l) => l.i === id);
        const size = sourceLayout ?? { x: 0, y: 0, ...CARD_DEFAULT_SIZE[source.cardType] };
        const newId = crypto.randomUUID();
        const copy: DashboardCard = {
          ...source,
          id: newId,
          title: `${source.title} (copy)`,
        };
        const index = cards.findIndex((c) => c.id === id);
        set((state) => ({
          cards: [...state.cards.slice(0, index + 1), copy, ...state.cards.slice(index + 1)],
          layout: compact([
            ...state.layout,
            // Directly below the original; the compactor settles collisions.
            { i: newId, x: size.x, y: size.y + size.h, w: size.w, h: size.h },
          ]),
        }));
      },

      updateCard: (id, title, config) => {
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? { ...c, title, config } : c)),
        }));
      },

      removeCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== id),
          layout: state.layout.filter((l) => l.i !== id),
        }));
      },

      clearAll: () => set({ cards: [], layout: [] }),

      replaceState: (cards, layout) =>
        set({ cards: [...cards], layout: reconcileLayout(cards, layout) }),

      loadSample: () => {
        const { cards, layout } = buildSampleDashboard();
        set({ cards, layout: compact(layout) });
      },

      /** Sink for RGL's onLayoutChange. RGL v2's publish effect can echo a
       *  layout that's one commit stale — right after an external drop it
       *  emits its pre-drop internal layout, which is missing the slot
       *  `addCard` just wrote. Accepting that verbatim erases the new
       *  card's position, and RGL's adopt/publish effects then chase the
       *  alternating states forever ("Maximum update depth exceeded").
       *  So: a published layout missing any live card is that stale echo —
       *  reject it wholesale. Complete ones are accepted in cards order,
       *  stripped to contract fields (drops the `__dropping__` placeholder
       *  and RGL ephemera like `moved`), and no-op'd when nothing actually
       *  changed — the no-op is what breaks the cycle. */
      setLayout: (layout) =>
        set((state) => {
          const published = new Map(layout.map((l) => [l.i, l]));
          if (state.cards.some((card) => !published.has(card.id))) return state;
          const next = state.cards.map((card) => {
            const l = published.get(card.id) as GridLayoutItem;
            return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h };
          });
          return sameLayout(next, state.layout) ? state : { layout: next };
        }),
      setDraggingCardType: (draggingCardType) => set({ draggingCardType }),
    }),
    {
      name: "bms-dashboard-state",
      partialize: (state) => ({ cards: state.cards, layout: state.layout }),
      // v1: the design reskin changed the grid's row unit from 30px to
      // 198px rows; rescale persisted v0 heights/positions (46px and
      // 214px per row incl. margin) so old dashboards keep their shape.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { cards: DashboardCard[]; layout: GridLayoutItem[] };
        if (version === 0 && Array.isArray(state.layout)) {
          const scale = 46 / 214;
          state.layout = compact(
            state.layout.map((l) => ({
              ...l,
              y: Math.round(l.y * scale),
              h: Math.max(1, Math.round(l.h * scale)),
            })),
          );
        }
        return state;
      },
    },
  ),
);
