"use client";

import { DashboardState } from "@bms/contract";
import { Schema } from "effect";
import { useTheme } from "next-themes";
import { useRef } from "react";
import { toast } from "sonner";
import { IconExport, IconImport, IconPlus, IconPrint } from "@/components/icons";
import { SidebarTrigger } from "@/components/sidebar-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard-store";

// v4 beta ships Sync/Result/Option decoders (no *Either) — Sync +
// try/catch is the simplest fit for a synchronous file-import check.
const decodeDashboardState = Schema.decodeUnknownSync(DashboardState);

export function DashboardHeader({
  paletteOpen,
  onTogglePalette,
}: {
  paletteOpen: boolean;
  onTogglePalette: () => void;
}) {
  const mounted = useMounted();
  const cardCount = useDashboardStore((s) => s.cards.length);
  const replaceState = useDashboardStore((s) => s.replaceState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  const countLabel = !mounted
    ? "…"
    : cardCount === 0
      ? "no cards yet"
      : `${cardCount} ${cardCount === 1 ? "card" : "cards"}`;

  function handleExport() {
    const { cards, layout } = useDashboardStore.getState();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards,
      layout,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vs-dashboard-layout.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast.success("Layout exported as JSON");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        cards?: unknown;
        layout?: unknown;
      };
      // Validate against the shared contract schema — the same shape the
      // export wrote — so a hand-edited file can't smuggle in a config
      // the query API would reject wholesale.
      const state = decodeDashboardState({ cards: parsed.cards, layout: parsed.layout });
      replaceState(state.cards, state.layout);
      toast.success("Layout imported");
    } catch {
      toast.error("Invalid layout file");
    }
  }

  /** A4-landscape printable width (297mm − 2×10mm margins) at CSS 96dpi. */
  const PRINT_PAGE_WIDTH_PX = 1047;

  function handlePrint() {
    // Scale the grid to the paper width so the print keeps the exact
    // on-screen geometry (charts included) instead of reflowing — the
    // print stylesheet applies this via `zoom` on .bms-print-zoom.
    const grid = document.querySelector(".react-grid-layout");
    const gridWidth = grid?.getBoundingClientRect().width ?? 0;
    document.documentElement.style.setProperty(
      "--print-zoom",
      String(gridWidth > PRINT_PAGE_WIDTH_PX ? PRINT_PAGE_WIDTH_PX / gridWidth : 1),
    );
    // Print in the light theme — dark near-white text on stripped-out
    // dark backgrounds is unreadable on paper. Restore after the
    // (blocking) dialog closes; two rAFs let the theme swap paint first.
    const wasDark = resolvedTheme === "dark";
    if (wasDark) setTheme("light");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        if (wasDark) setTheme("dark");
      }),
    );
  }

  return (
    <header className="flex items-center gap-3.5 border-b bg-card px-[22px] pt-[15px] pb-[13px]">
      <SidebarTrigger />
      <div className="min-w-0">
        <h1 className="font-extrabold text-[18px] tracking-[-0.3px]">Dashboard Builder</h1>
        <div className="mt-px text-[12px] text-fg-subtle">
          Compose your single-pane operations view · {countLabel}
        </div>
      </div>
      <div className="flex-1" />
      <HeaderButton onClick={handlePrint}>
        <IconPrint size={15} />
        Print
      </HeaderButton>
      <HeaderButton onClick={handleExport}>
        <IconExport size={15} />
        Export
      </HeaderButton>
      <HeaderButton onClick={() => fileInputRef.current?.click()}>
        <IconImport size={15} />
        Import
      </HeaderButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={onTogglePalette}
        className={cn(
          "flex items-center gap-[7px] rounded-[9px] border px-[13px] py-2 font-semibold text-[12.5px] transition-[color,background-color,border-color,scale] active:scale-[0.97] print:hidden",
          paletteOpen
            ? "border-primary bg-accent text-primary"
            : "border-border bg-secondary text-muted-foreground hover:border-border-strong hover:text-foreground",
        )}
      >
        <IconPlus size={15} />
        Palette
      </button>
      <ThemeToggle />
    </header>
  );
}

function HeaderButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[7px] rounded-[9px] border bg-secondary px-[13px] py-2 font-semibold text-[12.5px] text-muted-foreground transition-[color,border-color,scale] hover:border-border-strong hover:text-foreground active:scale-[0.97] print:hidden"
    >
      {children}
    </button>
  );
}
