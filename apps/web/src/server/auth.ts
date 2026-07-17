import { Context, Effect, Layer } from "effect";
import { env } from "./env";
import {
  constantTimeStringEquals,
  SESSION_DURATION_MS,
  signSessionToken,
  verifySessionToken,
} from "./session-token";

export class AuthService extends Context.Service<
  AuthService,
  {
    readonly verifyPin: (pin: string) => Effect.Effect<boolean>;
    readonly signSession: () => Effect.Effect<string>;
    readonly verifySession: (token: string) => Effect.Effect<boolean>;
  }
>()("AuthService") {
  static readonly layer = Layer.succeed(this, {
    verifyPin: (pin) => Effect.sync(() => constantTimeStringEquals(pin, env.appPin)),
    // Raw Date.now(), NOT ClockService: proxy.ts's verify side is
    // Effect-free and uses real wall-clock time (session-token.ts), so
    // signing must too — a DEMO_NOW-shifted clock here would desync
    // sign-time from verify-time and break login whenever DEMO_NOW is set.
    signSession: () => Effect.sync(() => signSessionToken(Date.now() + SESSION_DURATION_MS)),
    verifySession: (token) => Effect.sync(() => verifySessionToken(token)),
  });
}
