import { describe, expect, test } from "bun:test";
import { TABLE_META } from "@bms/contract";
import { DB_COLUMN, DB_TABLE } from "./db-columns";

/**
 * TABLE_META (the request whitelist) and DB_COLUMN/DB_TABLE (the raw-SQL
 * identifier maps) are maintained by hand in two packages. The safety of
 * the raw line-chart query rests on TABLE_META ⊆ DB_COLUMN: every column
 * a request can validate against must resolve to a real DB identifier.
 * Extra DB_COLUMN keys are harmless (unreachable — validation runs
 * against TABLE_META first), so only this direction is locked.
 */
describe("TABLE_META ⊆ DB_COLUMN invariant", () => {
  for (const source of Object.keys(TABLE_META) as Array<keyof typeof TABLE_META>) {
    test(`every ${source} column has a raw-SQL identifier mapping`, () => {
      expect(DB_TABLE[source]).toBeString();
      for (const column of TABLE_META[source]) {
        expect(DB_COLUMN[source][column.name]).toBeString();
      }
    });
  }
});
