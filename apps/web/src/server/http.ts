import {
  type DbError,
  type UnauthorizedError,
  type UnknownColumnError,
  ValidationError,
} from "@bms/contract";
import { Effect, Schema } from "effect";
import { type AppServices, runtime } from "./runtime";

type ApiError = ValidationError | UnknownColumnError | UnauthorizedError | DbError;

/**
 * Maps every route's Effect to an HTTP Response. Tagged errors become
 * their documented status with the details the client needs to fix the
 * request (allowed columns, what was invalid); anything else (a defect —
 * an actual bug or infra failure) is logged in full server-side and the
 * client only ever sees a generic 500 message, never a stack trace.
 */
async function toResponse<A>(
  program: Effect.Effect<A, ApiError, AppServices>,
): Promise<Response> {
  const responseEffect = program.pipe(
    Effect.map((value) => Response.json(value)),
    Effect.catchTags({
      ValidationError: (error) =>
        Effect.succeed(
          Response.json(
            { error: error._tag, message: error.message, allowed: error.allowed },
            { status: 400 },
          ),
        ),
      UnknownColumnError: (error) =>
        Effect.succeed(
          Response.json(
            {
              error: error._tag,
              message: `Unknown column "${error.column}" for source "${error.source}"`,
              allowed: error.allowed,
            },
            { status: 400 },
          ),
        ),
      UnauthorizedError: (error) =>
        Effect.succeed(
          Response.json({ error: error._tag, message: error.message }, { status: 401 }),
        ),
      DbError: (error) =>
        Effect.succeed(
          Response.json({ error: error._tag, message: error.message }, { status: 500 }),
        ),
    }),
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        console.error("Unhandled route failure:", cause);
        return Response.json(
          { error: "InternalError", message: "Something went wrong" },
          { status: 500 },
        );
      }),
    ),
  );
  return runtime.runPromise(responseEffect);
}

/** For routes whose input is a JSON body validated against a contract schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- S's Type param is bound per call site, not needed here
export function handleJson<S extends Schema.Schema<any>, A>(
  schema: S,
  effectFn: (input: S["Type"]) => Effect.Effect<A, ApiError, AppServices>,
) {
  return async (request: Request): Promise<Response> => {
    const program = Effect.gen(function* () {
      const body = yield* Effect.tryPromise({
        try: () => request.json(),
        catch: () => new ValidationError({ message: "Request body must be valid JSON" }),
      });
      const input = yield* Schema.decodeUnknownEffect(schema)(body).pipe(
        Effect.mapError((err) => new ValidationError({ message: err.message })),
      );
      return yield* effectFn(input);
    });
    // None of the contract schemas use custom parsing services, so
    // DecodingServices is always `never` for any concrete schema passed
    // in — TS just can't see that through the generic `S` here.
    return toResponse(program as Effect.Effect<A, ApiError, AppServices>);
  };
}

/** For routes with no body (GET routes reading query params, or no input at all). */
export function handleEffect<A>(
  effectFn: () => Effect.Effect<A, ApiError, AppServices>,
): Promise<Response> {
  return toResponse(effectFn());
}
