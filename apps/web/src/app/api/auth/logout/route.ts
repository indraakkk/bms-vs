import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/server/session-token";

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
