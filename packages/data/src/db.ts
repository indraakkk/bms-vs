import { PgClient } from "@effect/sql-pg";
import { Config, Redacted } from "effect";

export const DbLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL").pipe(
    Config.withDefault(Redacted.make("postgresql:///venturesea")),
  ),
});
