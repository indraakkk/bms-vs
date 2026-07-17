"use client";

import type { CardType, DashboardCard, GridLayoutItem } from "@bms/contract";
import { useCallback, useMemo, useRef, useState } from "react";
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
  const enteringIds = useDashboardStore((s) => s.enteringIds);
  const ackEntered = useDashboardStore((s) => s.ackEntered);

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
  // the card plays its card-out keyframe, and its animationend event
  // finalizes the removal (RGL's transform transitions then animate the
  // re-compaction). The timer is only a safety net for the event never
  // firing (e.g. `animation: none` from some future rule); its map entry
  // doubles as the idempotency guard so event + fallback can't both
  // finalize. Timers deliberately survive unmount — they commit the
  // store removal the user already asked for. Each entry pins the exact
  // card object it was armed for: if the store was wholesale-replaced
  // mid-exit (clear canvas / sample / import can reinstate the same id
  // as a NEW object), finalize only cleans up instead of deleting-and-
  // toasting a card this removal no longer owns.
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
  const removalTimers = useRef(new Map<string, { timer: number; card: DashboardCard }>());

  const finalizeRemove = useCallback(
    (cardId: string, title: string) => {
      const entry = removalTimers.current.get(cardId);
      if (entry === undefined) return;
      window.clearTimeout(entry.timer);
      removalTimers.current.delete(cardId);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      const live = useDashboardStore.getState().cards.find((c) => c.id === cardId);
      if (live === entry.card) {
        removeCard(cardId);
        toast.success(`Removed "${title}"`);
      }
    },
    [removeCard],
  );

  const handleRemove = useCallback(
    (cardId: string, title: string) => {
      if (removalTimers.current.has(cardId)) return;
      const card = useDashboardStore.getState().cards.find((c) => c.id === cardId);
      if (!card) return;
      setRemovingIds((prev) => new Set(prev).add(cardId));
      removalTimers.current.set(cardId, {
        timer: window.setTimeout(() => finalizeRemove(cardId, title), 400),
        card,
      });
    },
    [finalizeRemove],
  );

  // New cards (added / duplicated / sample / imported this session) play
  // a short staggered card-in; hydrated cards render settled. CardShell
  // freezes its own slot at mount, so acks shifting this map are inert.
  const enterDelays = useMemo(() => {
    const entering = new Set(enteringIds);
    const delays = new Map<string, number>();
    let slot = 0;
    for (const card of cards) {
      if (entering.has(card.id)) delays.set(card.id, Math.min(slot++ * 45, 315));
    }
    return delays;
  }, [cards, enteringIds]);

  const gridChildren = useMemo(
    () =>
      cards.map((card) => (
        <div key={card.id}>
          <CardShell
            card={card}
            removing={removingIds.has(card.id)}
            entering={enterDelays.has(card.id)}
            enterDelayMs={enterDelays.get(card.id) ?? 0}
            onEntered={() => ackEntered(card.id)}
            onEdit={() => onEditCard(card.id)}
            onDuplicate={() => duplicateCard(card.id)}
            onRemove={() => handleRemove(card.id, card.title)}
            onRemoved={() => finalizeRemove(card.id, card.title)}
          />
        </div>
      )),
    [
      cards,
      removingIds,
      enterDelays,
      ackEntered,
      onEditCard,
      duplicateCard,
      handleRemove,
      finalizeRemove,
    ],
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
        <div className="pointer-events-none absolute inset-0 flex animate-[fade-up_0.3s_cubic-bezier(0.23,1,0.32,1)] flex-col items-center justify-center gap-4 p-6 text-center print:hidden">
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
            className="pointer-events-auto mt-1 flex items-center gap-2 rounded-[10px] bg-primary px-[18px] py-[11px] font-bold text-[13px] text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)] transition-[opacity,scale] hover:opacity-90 active:scale-[0.98]"
          >
            <IconPlus size={16} />
            Load sample dashboard
          </button>
        </div>
      )}
    </div>
  );
}
