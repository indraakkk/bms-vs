import { Schema } from "effect";

/**
 * Semantic validation failures (bad aggregation/cardType combos, gauge
 * min >= max, non-numeric metric with a sum/avg/min/max aggregation,
 * etc). Always names what was wrong and, where applicable, what's
 * allowed — the client should never have to guess.
 */
export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    allowed: Schema.optional(Schema.Array(Schema.String)),
  },
) {}

/** A card config referenced a column that isn't in TABLE_META for its source. */
export class UnknownColumnError extends Schema.TaggedErrorClass<UnknownColumnError>()(
  "UnknownColumnError",
  {
    source: Schema.String,
    column: Schema.String,
    allowed: Schema.Array(Schema.String),
  },
) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  },
) {}

/**
 * Wraps any database failure. `message` is always a safe, generic string
 * — the underlying error is logged server-side, never sent to the client.
 */
export class DbError extends Schema.TaggedErrorClass<DbError>()("DbError", {
  message: Schema.String,
}) {}
