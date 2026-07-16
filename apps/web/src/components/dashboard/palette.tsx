"use client";

import type { CardType } from "@bms/contract";
import { ActivityIcon, BarChart3Icon, GaugeIcon, HashIcon } from "lucide-react";
import { CARD_TYPE_LABEL } from "@/lib/card-defaults";
import { useDashboardStore } from "@/stores/dashboard-store";

const PALETTE_ITEMS: Array<{ cardType: CardType; icon: React.ElementType }> = [
  { cardType: "kpi", icon: HashIcon },
  { cardType: "bar", icon: BarChart3Icon },
  { cardType: "line", icon: ActivityIcon },
  { cardType: "gauge", icon: GaugeIcon },
];

export function Palette() {
  const addCard = useDashboardStore((s) => s.addCard);
  const setDraggingCardType = useDashboardStore((s) => s.setDraggingCardType);

  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE_ITEMS.map(({ cardType, icon: Icon }) => (
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
          onClick={() => addCard(cardType)}
          className="flex cursor-grab items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent active:cursor-grabbing"
          title={`Drag onto the grid, or click to add a ${CARD_TYPE_LABEL[cardType]} card`}
        >
          <Icon className="size-4 text-muted-foreground" />
          {CARD_TYPE_LABEL[cardType]}
        </button>
      ))}
    </div>
  );
}
