"use client";

import { API_PATHS } from "@bms/contract";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/sidebar";
import { cn } from "@/lib/utils";

/** The documented demo PIN (.env.example / README). The keypad is built
 *  around this 4-digit demo credential — auto-submitting on the 4th
 *  digit, exactly like the design mock. */
const PIN_LENGTH = 4;
const DEMO_PIN = "1234";

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
    [router, searchParams],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      if (submitting) return;
      setError(null);
      setPin((current) => {
        if (current.length >= PIN_LENGTH) return current;
        const next = current + digit;
        if (next.length === PIN_LENGTH) {
          // Let the 4th dot paint before the request fires, per the mock.
          setTimeout(() => submit(next), 170);
        }
        return next;
      });
    },
    [submitting, submit],
  );

  const pressBackspace = useCallback(() => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  }, []);

  // Physical keyboards work too — digits and backspace.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
      else if (e.key === "Backspace") pressBackspace();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDigit, pressBackspace]);

  return (
    <div
      key={shakeCount}
      className={cn(
        "w-[320px] max-w-full rounded-[20px] border bg-card px-[26px] py-[30px] shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)]",
        shakeCount > 0 ? "animate-[shake_0.4s_ease]" : "animate-[fade-up_0.4s_ease]",
      )}
    >
      <div className="mb-6 flex flex-col items-center gap-[5px]">
        <BrandMark className="mb-1.5 size-[52px] rounded-[14px] text-[19px]" />
        <div className="font-extrabold text-[19px]">Facilities Console</div>
        <div className="text-[12.5px] text-fg-subtle">Enter your access PIN to continue</div>
      </div>

      <div className="mb-[22px] flex justify-center gap-[13px]" aria-label="PIN progress">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 transition-all",
              i < pin.length ? "border-primary bg-primary" : "border-border-strong bg-transparent",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <KeypadButton key={digit} onClick={() => pressDigit(digit)} disabled={submitting}>
            {digit}
          </KeypadButton>
        ))}
        <KeypadButton
          onClick={pressBackspace}
          disabled={submitting}
          className="text-[16px] text-muted-foreground"
          aria-label="Delete last digit"
        >
          ⌫
        </KeypadButton>
        <KeypadButton onClick={() => pressDigit("0")} disabled={submitting}>
          0
        </KeypadButton>
        <span aria-hidden />
      </div>

      <div className="mt-[18px] flex flex-col items-center gap-[11px]">
        {error && (
          <p role="alert" className="font-semibold text-[12px] text-crit">
            {error}
          </p>
        )}
        <div className="font-mono text-[11.5px] text-fg-subtle">
          Demo PIN · {DEMO_PIN.split("").join(" ")}
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit(DEMO_PIN)}
          className="w-full rounded-[11px] bg-primary py-[11px] font-bold text-[13.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Enter demo workspace →"}
        </button>
      </div>
    </div>
  );
}

function KeypadButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border bg-secondary py-[15px] font-mono font-semibold text-[19px] transition-colors hover:border-border-strong active:bg-surface-3 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
