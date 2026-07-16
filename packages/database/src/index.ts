import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "./generated/client/client";

export * from "./generated/client/client";
export * from "./generated/client/models";
export * from "./generated/client/enums";
export * from "./clock";

export function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaMssql(databaseUrl);
  return new PrismaClient({ adapter });
}
