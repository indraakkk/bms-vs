"use client";

import { useState } from "react";
import { CardConfigModal } from "@/components/dashboard/card-config-modal";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Palette } from "@/components/dashboard/palette";

export default function DashboardPage() {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar />
      <Palette />
      <DashboardCanvas onEditCard={setEditingCardId} />
      <CardConfigModal cardId={editingCardId} onClose={() => setEditingCardId(null)} />
    </div>
  );
}
