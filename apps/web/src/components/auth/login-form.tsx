"use client";

import { API_PATHS } from "@bms/contract";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * `from` is attacker-controllable (a phishing link can set
 * `?from=//evil.com` or `?from=https://evil.com`) — only ever redirect
 * to a same-origin relative path, never anything that could send a
 * freshly-authenticated session off-site.
 */
function sanitizeRedirectTarget(value: string | null): string {
  if (!value) return "/dashboard";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://")
  ) {
    return "/dashboard";
  }
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(API_PATHS.authLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Invalid PIN");
        return;
      }
      const from = sanitizeRedirectTarget(searchParams.get("from"));
      router.push(from);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xs flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
    >
      <div className="text-center">
        <h1 className="font-semibold text-lg">BMS Dashboard</h1>
        <p className="text-muted-foreground text-sm">Enter your PIN to continue</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={submitting || pin.length === 0}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
