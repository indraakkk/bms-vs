import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-5"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, var(--accent), transparent), var(--background)",
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
