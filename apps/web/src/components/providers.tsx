"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    // Dark is the design's default theme; the sidebar toggle flips the
    // class on <html>. No system preference — the mock is explicit
    // dark-first with a manual Light/Dark switch.
    // disableTransitionOnChange: a theme flip swaps the whole token set;
    // per-element 150ms color transitions repaint at different times and
    // tear. Atomic swap also keeps Print's light-flip out of the print
    // snapshot's transition window.
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
