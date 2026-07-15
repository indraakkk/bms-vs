import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export type Device = {
  device_id: string;
  floor: number;
  metric_type: string;
  label: string;
};

export const listDevices = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<Device>`
    SELECT device_id, floor, metric_type, label
    FROM devices
    ORDER BY floor, metric_type
  `;
});
