import { DbLive, listDevices } from "@venturesea/data";
import { Effect } from "effect";
import { NextResponse } from "next/server";

export async function GET() {
  const devices = await Effect.runPromise(listDevices.pipe(Effect.provide(DbLive)));
  return NextResponse.json({ devices });
}
