import { clearCookie, db, json, readCookie, sha256, requireSameOrigin } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const token = readCookie(request), binding = db(); if (token && binding) await binding.prepare("DELETE FROM radar_sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
}
