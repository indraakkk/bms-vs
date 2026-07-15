import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DbLive } from "../db";

const migrationsDir = dirname(fileURLToPath(import.meta.url));

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = yield* sql<{ name: string }>`SELECT name FROM schema_migrations`;
  const appliedNames = new Set(applied.map((row) => row.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) {
      yield* Effect.log(`skip ${file} (already applied)`);
      continue;
    }
    const contents = readFileSync(join(migrationsDir, file), "utf8");
    yield* Effect.log(`applying ${file}`);
    yield* sql.unsafe(contents);
    yield* sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
  }

  yield* Effect.log("migrations up to date");
});

Effect.runPromise(program.pipe(Effect.provide(DbLive))).catch((error) => {
  console.error(error);
  process.exit(1);
});
