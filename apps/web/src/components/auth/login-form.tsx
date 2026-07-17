"use client";

import { API_PATHS } from "@bms/contract";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { BrandMark } from "@/components/sidebar";
import { cn } from "@/lib/utils";

/** Dev convenience only — the documented dev PIN (.env.example / README).
 *  The hint and one-click button below render exclusively in development
 *  builds; a real deployment sets `APP_PIN` to an openssl-generated
 *  secret (e.g. `openssl rand -hex 16`, 32 chars) and gets a bare input. */
const DEV_PIN = "1234";
const IS_DEV = process.env.NODE_ENV === "development";

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
  const [shakeCount, setShakeCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (candidate: string) => {
      if (!candidate || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(API_PATHS.authLogin, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: candidate }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message ?? "Invalid PIN");
          setShakeCount((n) => n + 1);
          setPin("");
          return;
        }
        const from = sanitizeRedirectTarget(searchParams.get("from"));
        router.push(from);
        router.refresh();
      } finally {
        setSubmitting(false);
      }
    },
    [router, searchParams, submitting],
  );

  return (
    <div
      key={shakeCount}
      className={cn(
        "w-[320px] max-w-full rounded-[20px] border bg-card px-[26px] py-[30px] shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)]",
        // The shake's sharp curve is the classic "input rejected" jolt; a
        // soft `ease` at 400ms read as a wobble, not a refusal.
        shakeCount > 0
          ? "animate-[shake_0.3s_cubic-bezier(0.36,0.07,0.19,0.97)]"
          : "animate-[fade-up_0.35s_cubic-bezier(0.23,1,0.32,1)]",
      )}
    >
      <div className="mb-6 flex flex-col items-center gap-[5px]">
        <BrandMark className="mb-1.5 size-[52px] rounded-[14px] text-[19px]" />
        <div className="font-extrabold text-[19px]">Facilities Console</div>
        <div className="text-[12.5px] text-fg-subtle">Enter your access PIN to continue</div>
      </div>

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(pin);
        }}
      >
        <label htmlFor="pin" className="sr-only">
          Access PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Access PIN"
          value={pin}
          disabled={submitting}
          onChange={(e) => {
            setError(null);
            setPin(e.target.value);
          }}
          className="w-full rounded-xl border bg-secondary px-4 py-[13px] text-center font-mono font-semibold text-[15px] tracking-[0.35em] outline-none transition-colors placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:border-border-strong disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting || pin.length === 0}
          className="w-full rounded-[11px] bg-primary py-[11px] font-bold text-[13.5px] text-primary-foreground transition-[opacity,scale] hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Unlock console"}
        </button>
      </form>

      <div className="mt-[18px] flex flex-col items-center gap-[11px]">
        {error && (
          <p role="alert" className="font-semibold text-[12px] text-crit">
            {error}
          </p>
        )}
        {IS_DEV && (
          <>
            <div className="font-mono text-[11.5px] text-fg-subtle">
              Dev PIN · {DEV_PIN.split("").join(" ")}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(DEV_PIN)}
              className="w-full rounded-[11px] border bg-secondary py-[11px] font-bold text-[13.5px] transition-[border-color,scale] hover:border-border-strong active:scale-[0.98] disabled:opacity-60"
            >
              Enter demo workspace →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
