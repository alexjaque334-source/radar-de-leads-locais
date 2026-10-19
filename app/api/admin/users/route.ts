import { env } from "cloudflare:workers";
import { currentUser, db, json, requireSameOrigin, readJsonObject } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
async function authorized(request: Request) {
  const identity = await currentUser(request);
  const expected = (env as typeof env & { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(identity && expected && identity.email.toLowerCase() === expected);
}
export async function GET(request: Request) {
  if (!(await authorized(request))) return json({ error: "Acesso restrito ao superadmin. Entre com a conta administradora." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const rows = await binding.prepare("SELECT id,email,status,created_at,approved_at FROM radar_users ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 500").all();
  return json({ users: rows.results || [] });
}
export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  if (!(await authorized(request))) return json({ error: "Acesso restrito ao superadmin." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const body = await readJsonObject(request, 2_048); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  const id = typeof body.id === "string" ? body.id : "", status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : "";
  if (!id || !status) return json({ error: "Conta ou decisão inválida." }, 400);
  const result = await binding.prepare("UPDATE radar_users SET status=?, approved_at=CASE WHEN ?='approved' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?").bind(status,status,id).run();
  if (!result.meta.changes) return json({ error: "Conta não encontrada." }, 404);
  if (status === "rejected") await binding.prepare("DELETE FROM radar_sessions WHERE user_id=?").bind(id).run();
  return json({ ok: true, status });
}
export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  if (!(await authorized(request))) return json({ error: "Acesso restrito ao superadmin." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Conta inválida." }, 400);
  await binding.batch([
    binding.prepare("DELETE FROM radar_leads WHERE user_id=?").bind(id),
    binding.prepare("DELETE FROM radar_sessions WHERE user_id=?").bind(id),
    binding.prepare("DELETE FROM radar_users WHERE id=?").bind(id),
  ]);
  return json({ ok: true });
}
