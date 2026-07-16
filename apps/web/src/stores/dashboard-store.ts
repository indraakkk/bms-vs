import type { CardConfig, CardType, DashboardCard, GridLayoutItem } from "@bms/contract";
import { verticalCompactor } from "react-grid-layout";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARD_DEFAULT_SIZE, defaultCardTitle } from "@/lib/card-defaults";

const GRID_COLS = 12;

// GridLayoutItem (contract) and RGL's LayoutItem are structurally
// identical ({i,x,y,w,h}) — just two independently-declared types.
function compact(layout: GridLayoutItem[]): GridLayoutItem[] {
  return verticalCompactor.compact(
    layout as unknown as Parameters<typeof verticalCompactor.compact>[0],
    GRID_COLS,
  ) as unknown as GridLayoutItem[];
}

interface DashboardStoreState {
  cards: DashboardCard[];
  layout: GridLayoutItem[];
  /** Transient — not persisted. Which palette tile is being dragged, for the RGL ghost placeholder. */
  draggingCardType: CardType | null;
  addCard: (cardType: CardType, position?: { x: number; y: number }) => void;
  updateCard: (id: string, title: string, config: CardConfig) => void;
  removeCard: (id: string) => void;
  setLayout: (layout: GridLayoutItem[]) => void;
  setDraggingCardType: (cardType: CardType | null) => void;
}

export const useDashboardStore = create<DashboardStoreState>()(
  persist(
    (set) => ({
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

      setLayout: (layout) => set({ layout }),
      setDraggingCardType: (draggingCardType) => set({ draggingCardType }),
    }),
    {
      name: "bms-dashboard-state",
      partialize: (state) => ({ cards: state.cards, layout: state.layout }),
    },
  ),
);
