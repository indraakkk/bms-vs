"use client";

import { API_PATHS } from "@bms/contract";
import { LayoutGridIcon, LogOutIcon, MapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGridIcon },
  { href: "/floor-plan", label: "Floor Plan", icon: MapIcon },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch(API_PATHS.authLogout, { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
        <span className="font-semibold text-sm">BMS Dashboard</span>
        <nav className="flex flex-1 gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOutIcon className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}
