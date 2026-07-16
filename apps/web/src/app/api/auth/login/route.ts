import { LoginRequest, UnauthorizedError, ValidationError } from "@bms/contract";
import { Effect, Schema } from "effect";
import { cookies } from "next/headers";
import { AuthService } from "@/server/auth";
import { runtime } from "@/server/runtime";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/server/session-token";

export async function POST(request: Request) {
  const program = Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new ValidationError({ message: "Request body must be valid JSON" }),
    });
    const { pin } = yield* Schema.decodeUnknownEffect(LoginRequest)(body).pipe(
      Effect.mapError((err) => new ValidationError({ message: err.message })),
    );
    const auth = yield* AuthService;
    const valid = yield* auth.verifyPin(pin);
    if (!valid) {
      return yield* Effect.fail(new UnauthorizedError({ message: "Invalid PIN" }));
    }
    return yield* auth.signSession();
  });

  const outcome = await runtime.runPromise(
    program.pipe(
      Effect.map((token) => ({ ok: true as const, token })),
      Effect.catchTags({
        ValidationError: (e) => Effect.succeed({ ok: false as const, status: 400, message: e.message }),
        UnauthorizedError: (e) => Effect.succeed({ ok: false as const, status: 401, message: e.message }),
      }),
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          console.error("Login failed:", cause);
          return { ok: false as const, status: 500, message: "Something went wrong" };
        }),
      ),
    ),
  );

  if (!outcome.ok) {
    return Response.json({ message: outcome.message }, { status: outcome.status });
  }

  (await cookies()).set(SESSION_COOKIE_NAME, outcome.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return Response.json({ ok: true });
}
