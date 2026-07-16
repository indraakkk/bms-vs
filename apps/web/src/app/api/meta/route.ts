import { Effect } from "effect";
import { handleEffect } from "@/server/http";
import { MetaService } from "@/server/meta";

export async function GET() {
  return handleEffect(() =>
    Effect.gen(function* () {
      const meta = yield* MetaService;
      return yield* meta.get();
    }),
  );
}
