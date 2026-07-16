import { QueryRequest } from "@bms/contract";
import { Effect } from "effect";
import { handleJson } from "@/server/http";
import { QueryService } from "@/server/query";

export const POST = handleJson(QueryRequest, (request) =>
  Effect.gen(function* () {
    const queryService = yield* QueryService;
    return yield* queryService.execute(request.config, request.globalFilters);
  }),
);
