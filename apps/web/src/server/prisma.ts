import { createPrismaClient, type PrismaClient } from "@bms/database";
import { Context, Effect, Layer } from "effect";
import { env } from "./env";

export class PrismaService extends Context.Service<PrismaService, PrismaClient>()(
  "PrismaService",
) {
  static readonly layer = Layer.effect(
    this,
    Effect.acquireRelease(
      Effect.sync(() => createPrismaClient(env.databaseUrl)),
      (client) => Effect.promise(() => client.$disconnect()),
    ),
  );
}
