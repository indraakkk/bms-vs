"use client";

import { API_PATHS } from "@bms/contract";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconDashboard,
  IconFloorPlan,
  IconLock,
  IconMoon,
  IconSun,
} from "@/components/icons";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard Builder", icon: IconDashboard },
  { href: "/floor-plan", label: "Floor Plan", icon: IconFloorPlan },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLock() {
    await fetch(API_PATHS.authLogout, { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-[238px] shrink-0 flex-col gap-1 border-r bg-card px-3.5 py-[18px] print:hidden">
      <div className="flex items-center gap-[11px] px-1.5 pt-1 pb-4">
        <BrandMark className="size-[38px] rounded-[10px] text-[15px]" />
        <div className="leading-[1.15]">
          <div className="font-extrabold text-[15px] tracking-[-0.2px]">VS · BMS</div>
          <div className="font-medium text-[11px] text-fg-subtle">Building Management</div>
        </div>
      </div>

      <div className="px-2 pt-1.5 pb-1 font-bold text-[10.5px] text-fg-subtle tracking-[0.9px]">
        WORKSPACE
      </div>
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex w-full items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-left font-semibold text-[13.5px] transition-colors",
            pathname === href
              ? "bg-accent text-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}

      <div className="flex-1" />

      <SystemClock />

      <div className="mb-2 flex gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLock}
          title="Lock console"
          className="flex w-10 items-center justify-center rounded-[10px] border bg-secondary text-muted-foreground transition-[color,border-color,scale] hover:border-border-strong hover:text-foreground active:scale-[0.97]"
        >
          <IconLock size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2.5 border-t px-2 py-[9px]">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-surface-3 font-bold text-[12px] text-muted-foreground">
          FO
        </div>
        <div className="min-w-0 leading-[1.2]">
          <div className="truncate font-semibold text-[12.5px]">Facilities Ops</div>
          <div className="text-[10.5px] text-fg-subtle">Both buildings</div>
        </div>
      </div>
    </aside>
  );
}

/** The "VS" gradient tile, shared with the login screen. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-extrabold text-white tracking-[0.5px]",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary), #000 22%))",
        boxShadow: "0 4px 14px -4px var(--primary)",
      }}
    >
      VS
    </div>
  );
}

function SystemClock() {
  // Rendered client-side only (starts null) — a server-rendered wall
  // clock can never match the client's hydration instant. State is only
  // ever set from timer callbacks (never the effect body), per the
  // react-hooks/set-state-in-effect rule.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const first = setTimeout(update, 0);
    const t = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="mb-2 rounded-xl border bg-secondary px-[13px] py-3">
      <div className="mb-1.5 flex items-center gap-[7px]">
        <span className="size-[7px] animate-[livedot_1.6s_ease-in-out_infinite] rounded-full bg-ok" />
        <span className="font-bold text-[10.5px] text-fg-subtle tracking-[0.7px]">
          SYSTEM TIME
        </span>
      </div>
      <div className="font-medium font-mono text-[22px] leading-none tracking-[0.5px]">
        {now
          ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "--:--:--"}
      </div>
      <div className="mt-[3px] text-[11.5px] text-muted-foreground">
        {now
          ? now.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : " "}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border bg-secondary py-[9px] font-semibold text-[12.5px] text-muted-foreground transition-[color,border-color,scale] hover:border-border-strong hover:text-foreground active:scale-[0.97]"
    >
      {/* Theme is unknowable server-side; render a stable label until mounted. */}
      {mounted && isDark ? (
        <>
          <IconSun size={16} />
          Light
        </>
      ) : (
        <>
          <IconMoon size={16} />
          Dark
        </>
      )}
    </button>
  );
}
