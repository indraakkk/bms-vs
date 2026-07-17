"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IconPanelLeft } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Offcanvas sidebar collapse, after shadcn dashboard-01's
 * SidebarProvider/SidebarTrigger — state + trigger only, the visuals
 * stay this app's own. Defaults open, in-memory (no persistence; a
 * localStorage default would hydration-mismatch the width transition).
 */
const SidebarContext = createContext<{ open: boolean; toggle: () => void } | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // dashboard-01's keyboard shortcut: ⌘B / Ctrl+B toggles the sidebar.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return <SidebarContext.Provider value={{ open, toggle }}>{children}</SidebarContext.Provider>;
}

/** Header-left toggle button, ghost-styled like the card action icons. */
export function SidebarTrigger() {
  const { toggle } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={toggle}
          className="-ml-1.5 flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-[color,background-color,scale] hover:bg-surface-3 hover:text-foreground active:scale-95 print:hidden"
        >
          <IconPanelLeft size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>Toggle sidebar ⌘B</TooltipContent>
    </Tooltip>
  );
}
