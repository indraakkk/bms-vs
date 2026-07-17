"use client";

import { useTheme } from "next-themes";
import { IconMoon, IconSun } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Header theme switcher (top-right of each page header). Icon-only —
 * the tooltip carries the label, matching the HeaderButton styling so
 * it reads as part of the header's action cluster.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";
  // Theme is unknowable server-side; render a stable glyph until mounted.
  const label = mounted && isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex size-[34px] items-center justify-center rounded-[9px] border bg-secondary text-muted-foreground transition-[color,border-color,scale] hover:border-border-strong hover:text-foreground active:scale-[0.97] print:hidden"
        >
          {mounted && isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
