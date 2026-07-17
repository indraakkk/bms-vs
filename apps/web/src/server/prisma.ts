import { DbError } from "@bms/contract";
import { createPrismaClient, type PrismaClient } from "@bms/database";
import { Context, Effect, Layer } from "effect";
import { env } from "./env";

export class PrismaService extends Context.Service<PrismaService, PrismaClient>()(
  "PrismaService",
) {
  static readonly layer = Layer.effect(
    this,
    Effect.acquireRelease(
      Effect.sync(() =>
        createPrismaClient(env.databaseUrl, { logQueries: env.logQueries }),
      ),
      (client) => Effect.promise(() => client.$disconnect()),
    ),
  );
}

/**
 * Every Prisma call in a service goes through this: the underlying error
 * is logged in full server-side, and callers see the typed `DbError`
 * (→ HTTP 500 with a safe generic message) instead of an untyped defect —
 * so DB failure is visible in service signatures, not invisible to them.
 */
export function tryDb<A>(run: () => Promise<A>): Effect.Effect<A, DbError> {
  return Effect.tryPromise({
    try: run,
    catch: (error) => {
      console.error("Database call failed:", error);
      return new DbError({ message: "Database query failed" });
    },
  });
}
