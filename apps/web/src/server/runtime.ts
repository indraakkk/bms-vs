import { Layer, ManagedRuntime } from "effect";
import { AuthService } from "./auth";
import { ClockService } from "./clock";
import { MetaService } from "./meta";
import { OccupancyService } from "./occupancy";
import { PrismaService } from "./prisma";
import { QueryService } from "./query";

const infra = Layer.mergeAll(PrismaService.layer, ClockService.layer);

const AppLayer = Layer.mergeAll(
  infra,
  QueryService.layer.pipe(Layer.provide(infra)),
  MetaService.layer.pipe(Layer.provide(infra)),
  OccupancyService.layer.pipe(Layer.provide(infra)),
  AuthService.layer,
);

/** Every service route handlers may require — what `runtime` provides. */
export type AppServices =
  | PrismaService
  | ClockService
  | QueryService
  | MetaService
  | OccupancyService
  | AuthService;

function makeRuntime() {
  return ManagedRuntime.make(AppLayer);
}

// Memoized on globalThis so Next dev's hot-reload doesn't leak a fresh
// Prisma connection pool on every module re-evaluation — the same trick
// the classic Prisma singleton pattern uses.
declare global {
  var __bmsRuntime: ReturnType<typeof makeRuntime> | undefined;
}

export const runtime = globalThis.__bmsRuntime ?? (globalThis.__bmsRuntime = makeRuntime());
