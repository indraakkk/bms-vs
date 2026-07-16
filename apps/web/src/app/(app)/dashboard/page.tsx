"use client";

import { useState } from "react";
import { CardConfigModal } from "@/components/dashboard/card-config-modal";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Palette } from "@/components/dashboard/palette";

export default function DashboardPage() {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <DashboardHeader
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((open) => !open)}
      />
      <FilterBar />
      <div className="flex min-h-0 flex-1">
        {paletteOpen && <Palette onCardAdded={setEditingCardId} />}
        <DashboardCanvas onEditCard={setEditingCardId} />
      </div>
      <CardConfigModal cardId={editingCardId} onClose={() => setEditingCardId(null)} />
    </div>
  );
}
