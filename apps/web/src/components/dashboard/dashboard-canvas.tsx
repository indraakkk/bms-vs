"use client";

import type { CardType, GridLayoutItem } from "@bms/contract";
import { useCallback, useMemo, useState } from "react";
import GridLayout, { useContainerWidth } from "react-grid-layout";
import { toast } from "sonner";
import { CardShell } from "@/components/dashboard/card-shell";
import { IconCanvasEmpty, IconPlus } from "@/components/icons";
import { useMounted } from "@/hooks/use-mounted";
import { CARD_DEFAULT_SIZE } from "@/lib/card-defaults";
import { useDashboardStore } from "@/stores/dashboard-store";

// 198px rows on a 12-col grid = the design's 4-col × 198px card lattice.
const GRID_CONFIG = { cols: 12, rowHeight: 198, margin: [16, 16] as const };
// Cards drag by their header strip only (charts own the body's pointer).
const DRAG_CONFIG = {
  handle: ".bms-card-drag",
  cancel: "button, a, input, [data-no-drag]",
};
const DEFAULT_DROP_SIZE = { w: 3, h: 1 };

export function DashboardCanvas({ onEditCard }: { onEditCard: (cardId: string) => void }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const storeHydrated = useMounted();
  const cards = useDashboardStore((s) => s.cards);
  const layout = useDashboardStore((s) => s.layout);
  const draggingCardType = useDashboardStore((s) => s.draggingCardType);
  const setLayout = useDashboardStore((s) => s.setLayout);
  const addCard = useDashboardStore((s) => s.addCard);
  const removeCard = useDashboardStore((s) => s.removeCard);
  const duplicateCard = useDashboardStore((s) => s.duplicateCard);
  const loadSample = useDashboardStore((s) => s.loadSample);

  const dropConfig = useMemo(
    () => ({
      enabled: true,
      defaultItem: draggingCardType ? CARD_DEFAULT_SIZE[draggingCardType] : DEFAULT_DROP_SIZE,
    }),
    [draggingCardType],
  );

  const droppingItem = useMemo(
    () =>
      draggingCardType
        ? { i: "__dropping__", x: 0, y: 0, ...CARD_DEFAULT_SIZE[draggingCardType] }
        : undefined,
    [draggingCardType],
  );

  const handleLayoutChange = useCallback(
    (newLayout: unknown) => {
      // RGL's Layout and the contract's GridLayoutItem are structurally
      // identical ({i,x,y,w,h}) — just two independently-declared types.
      setLayout(newLayout as GridLayoutItem[]);
    },
    [setLayout],
  );

  const handleDrop = useCallback(
    (_layout: unknown, item: { x: number; y: number } | undefined, e: Event) => {
      const dragEvent = e as unknown as DragEvent;
      const cardType = dragEvent.dataTransfer?.getData(
        "application/bms-card-type",
      ) as CardType | "";
      if (cardType && item) {
        // Straight into configuration, as in the mock — a fresh card is
        // useless until it has a source and axes.
        onEditCard(addCard(cardType, { x: item.x, y: item.y }));
      }
    },
    [addCard, onEditCard],
  );

  // Cards animate out before they leave the store: Remove marks the id,
  // the card plays its card-out keyframe, and only then does removeCard
  // unmount it (RGL's transform transitions animate the re-compaction).
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());

  const handleRemove = useCallback(
    (cardId: string, title: string) => {
      setRemovingIds((prev) => {
        if (prev.has(cardId)) return prev;
        return new Set(prev).add(cardId);
      });
      window.setTimeout(() => {
        removeCard(cardId);
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
        toast.success(`Removed "${title}"`);
      }, 200);
    },
    [removeCard],
  );

  const gridChildren = useMemo(
    () =>
      cards.map((card) => (
        <div key={card.id}>
          <CardShell
            card={card}
            removing={removingIds.has(card.id)}
            onEdit={() => onEditCard(card.id)}
            onDuplicate={() => duplicateCard(card.id)}
            onRemove={() => handleRemove(card.id, card.title)}
          />
        </div>
      )),
    [cards, removingIds, onEditCard, duplicateCard, handleRemove],
  );

  const isEmpty = storeHydrated && cards.length === 0;

  return (
    <div className="relative min-h-0 flex-1 overflow-auto p-5 print:overflow-visible">
      {/* Keep the (empty) grid measurable and droppable behind the hero. */}
      <div ref={containerRef} className="bms-print-zoom [&_.react-grid-layout]:min-h-[420px]">
        {mounted && (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={GRID_CONFIG}
            dragConfig={DRAG_CONFIG}
            dropConfig={dropConfig}
            droppingItem={droppingItem}
            onLayoutChange={handleLayoutChange}
            onDrop={handleDrop}
          >
            {gridChildren}
          </GridLayout>
        )}
      </div>
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex animate-[fade-up_0.4s_ease] flex-col items-center justify-center gap-4 p-6 text-center print:hidden">
          <div className="flex size-[92px] items-center justify-center rounded-[20px] border-2 border-border-strong border-dashed text-fg-subtle">
            <IconCanvasEmpty size={40} />
          </div>
          <div>
            <h2 className="mb-1.5 font-extrabold text-[20px]">Your canvas is empty</h2>
            <p className="mx-auto max-w-[380px] text-[13.5px] text-muted-foreground leading-normal">
              Drag a card type from the palette onto the canvas, or load a sample to see energy,
              occupancy &amp; HVAC come to life.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSample}
            className="pointer-events-auto mt-1 flex items-center gap-2 rounded-[10px] bg-primary px-[18px] py-[11px] font-bold text-[13px] text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)] transition-opacity hover:opacity-90"
          >
            <IconPlus size={16} />
            Load sample dashboard
          </button>
        </div>
      )}
    </div>
  );
}
