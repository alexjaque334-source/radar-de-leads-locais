import { env } from "cloudflare:workers";
import { currentUser, db, json, requireSameOrigin, readCookie, sha256 } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export async function GET(request: Request) {
  const binding = db(); if (!binding) return json({ authenticated: false, configured: false }, 200);
  const user = await currentUser(request); if (!user) return json({ authenticated: false }, 200);
  const ownerEmail = (env as typeof env & { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL?.trim().toLowerCase();
  return json({ authenticated: true, user: { email: user.email, isOwner: Boolean(ownerEmail && user.email.toLowerCase() === ownerEmail) } });
}
export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const token = readCookie(request); if (!token) return json({ error: "Sessão não encontrada." }, 401);
  const session = await binding.prepare("SELECT user_id FROM radar_sessions WHERE token_hash=?").bind(await sha256(token)).first<{user_id:string}>();
  if (!session) return json({ error: "Sessão não encontrada." }, 401);
  await binding.batch([
    binding.prepare("DELETE FROM radar_leads WHERE user_id=?").bind(session.user_id),
    binding.prepare("DELETE FROM radar_sessions WHERE user_id=?").bind(session.user_id),
    binding.prepare("DELETE FROM radar_users WHERE id=?").bind(session.user_id),
  ]);
  return json({ ok: true }, 200, { "Set-Cookie": "radar_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
}
