import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "./generated/client/client";

export * from "./generated/client/client";
export * from "./generated/client/models";
export * from "./generated/client/enums";
export * from "./clock";

/**
 * `logQueries` subscribes to Prisma's query event log and prints every
 * executed SQL statement with its bound parameters and execution time —
 * the debugging aid the take-home lists as a bonus. Off by default: it's
 * per-statement stdout noise, so callers opt in (apps/web gates it behind
 * the QUERY_LOG env var).
 */
export function createPrismaClient(
  databaseUrl: string,
  options?: { logQueries?: boolean },
): PrismaClient {
  const adapter = new PrismaMssql(databaseUrl);
  if (!options?.logQueries) {
    return new PrismaClient({ adapter });
  }
  const client = new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }],
  });
  client.$on("query", (event) => {
    console.log(
      `[sql ${event.duration.toFixed(1)}ms] ${event.query.replace(/\s+/g, " ").trim()} -- params: ${event.params}`,
    );
  });
  return client;
}
