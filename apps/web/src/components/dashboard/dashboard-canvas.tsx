"use client";

import type { CardType, GridLayoutItem } from "@bms/contract";
import { useCallback, useMemo } from "react";
import GridLayout, { useContainerWidth } from "react-grid-layout";
import { toast } from "sonner";
import { CardShell } from "@/components/dashboard/card-shell";
import { CARD_DEFAULT_SIZE } from "@/lib/card-defaults";
import { useDashboardStore } from "@/stores/dashboard-store";

const GRID_CONFIG = { cols: 12, rowHeight: 30, margin: [16, 16] as const };
const DRAG_CONFIG = { cancel: "button, a, input, [data-no-drag]" };
const DEFAULT_DROP_SIZE = { w: 3, h: 3 };

export function DashboardCanvas({ onEditCard }: { onEditCard: (cardId: string) => void }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const cards = useDashboardStore((s) => s.cards);
  const layout = useDashboardStore((s) => s.layout);
  const draggingCardType = useDashboardStore((s) => s.draggingCardType);
  const setLayout = useDashboardStore((s) => s.setLayout);
  const addCard = useDashboardStore((s) => s.addCard);
  const removeCard = useDashboardStore((s) => s.removeCard);

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
        addCard(cardType, { x: item.x, y: item.y });
      }
    },
    [addCard],
  );

  const gridChildren = useMemo(
    () =>
      cards.map((card) => (
        <div key={card.id}>
          <CardShell
            card={card}
            onEdit={() => onEditCard(card.id)}
            onRemove={() => {
              removeCard(card.id);
              toast.success(`Removed "${card.title}"`);
            }}
          />
        </div>
      )),
    [cards, onEditCard, removeCard],
  );

  return (
    <div ref={containerRef} className="min-h-[60vh]">
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
      {cards.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
          Drag a card from the palette to get started
        </div>
      )}
    </div>
  );
}
