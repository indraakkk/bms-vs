"use client";

import type { CardType } from "@bms/contract";
import { CARD_TYPE_ICON } from "@/components/icons";
import { useMounted } from "@/hooks/use-mounted";
import { CARD_TYPE_DESC, CARD_TYPE_LABEL } from "@/lib/card-defaults";
import { useDashboardStore } from "@/stores/dashboard-store";

const PALETTE_ITEMS: CardType[] = ["kpi", "bar", "line", "gauge"];

export function Palette({ onCardAdded }: { onCardAdded: (cardId: string) => void }) {
  const mounted = useMounted();
  const addCard = useDashboardStore((s) => s.addCard);
  const setDraggingCardType = useDashboardStore((s) => s.setDraggingCardType);
  const loadSample = useDashboardStore((s) => s.loadSample);
  const clearAll = useDashboardStore((s) => s.clearAll);
  const hasCards = useDashboardStore((s) => s.cards.length > 0);

  return (
    <aside className="flex w-[232px] shrink-0 flex-col gap-[9px] overflow-auto border-r bg-card px-3.5 py-4 print:hidden">
      <div className="mb-0.5">
        <div className="font-bold text-[13px]">Card Palette</div>
        <div className="mt-px text-[11.5px] text-fg-subtle">
          Drag onto the canvas, or click to add
        </div>
      </div>

      {PALETTE_ITEMS.map((cardType) => {
        const Icon = CARD_TYPE_ICON[cardType];
        return (
          <button
            key={cardType}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/bms-card-type", cardType);
              e.dataTransfer.effectAllowed = "copy";
              setDraggingCardType(cardType);
            }}
            onDragEnd={() => setDraggingCardType(null)}
            onClick={() => onCardAdded(addCard(cardType))}
            // Tailwind v4 emits `translate`/`scale` as standalone CSS
            // properties — `transform` in a transition list doesn't cover
            // them, so the hover lift was snapping.
            className="flex cursor-grab items-start gap-[11px] rounded-xl border bg-secondary p-3 text-left transition-[translate,scale,border-color] duration-100 hover:-translate-y-px hover:border-primary active:translate-y-0 active:scale-[0.98] active:cursor-grabbing"
            title={`Drag onto the grid, or click to add a ${CARD_TYPE_LABEL[cardType]}`}
          >
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-primary">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-[13px]">{CARD_TYPE_LABEL[cardType]}</span>
              <span className="mt-px block text-[11px] text-fg-subtle leading-[1.3]">
                {CARD_TYPE_DESC[cardType]}
              </span>
            </span>
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        onClick={loadSample}
        className="flex items-center justify-center gap-[7px] rounded-[10px] border border-border-strong border-dashed bg-transparent p-[9px] font-semibold text-[12px] text-muted-foreground transition-[color,border-color,scale] hover:border-primary hover:text-foreground active:scale-[0.98]"
      >
        Load sample dashboard
      </button>
      {mounted && hasCards && (
        <button
          type="button"
          onClick={clearAll}
          className="p-2 font-semibold text-[12px] text-fg-subtle transition-[color,scale] hover:text-crit active:scale-[0.97]"
        >
          Clear canvas
        </button>
      )}
    </aside>
  );
}
