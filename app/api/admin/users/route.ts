import {validPlan} from "@/app/lib/subscriptions";
import { env } from "cloudflare:workers";
import { currentUser, db, json, requireSameOrigin, readJsonObject } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
async function adminIdentity(request: Request) {
  const identity = await currentUser(request);
  const expected = (env as typeof env & { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL?.trim().toLowerCase();
  return identity && expected && identity.email.toLowerCase() === expected ? identity : null;
}
function configuredAdminEmail() {
  return (env as typeof env & { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL?.trim().toLowerCase() || "";
}
export async function GET(request: Request) {
  if (!(await adminIdentity(request))) return json({ error: "Acesso restrito ao superadmin. Entre com a conta administradora." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const adminEmail = configuredAdminEmail();
  const rows = await binding.prepare("SELECT u.id,u.email,u.status,u.created_at,u.approved_at,COALESCE(p.requested_plan,'essential') AS requested_plan,COALESCE(p.active_plan,'essential') AS active_plan FROM radar_users u LEFT JOIN alegon_user_plans p ON p.user_id=u.id WHERE lower(u.email) != ? ORDER BY CASE u.status WHEN 'pending' THEN 0 ELSE 1 END, u.created_at DESC LIMIT 500").bind(adminEmail).all();
  return json({ users: rows.results || [] });
}
export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const admin = await adminIdentity(request);
  if (!admin) return json({ error: "Acesso restrito ao superadmin." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const body = await readJsonObject(request, 2_048); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  const id = typeof body.id === "string" ? body.id : "", status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : "";
  if (!id || !status) return json({ error: "Conta ou decisão inválida." }, 400);
  if (id === admin.id) return json({ error: "A conta superadmin é protegida contra bloqueio e exclusão." }, 403);
  const target = await binding.prepare("SELECT email FROM radar_users WHERE id=? LIMIT 1").bind(id).first<{ email: string }>();
  if (!target) return json({ error: "Conta não encontrada." }, 404);
  if (target.email.trim().toLowerCase() === configuredAdminEmail()) return json({ error: "A conta superadmin é protegida contra bloqueio e exclusão." }, 403);
  const selectedPlan=body.plan;
  if(selectedPlan!==undefined&&!validPlan(selectedPlan))return json({error:"Plano inválido."},400);
  if(status==="approved"&&!selectedPlan){const existing=await binding.prepare("SELECT requested_plan FROM alegon_user_plans WHERE user_id=?").bind(id).first<{requested_plan:string}>();if(!existing)return json({error:"Plano não registrado; selecione um plano."},409);}
  const result = await binding.prepare("UPDATE radar_users SET status=?, approved_at=CASE WHEN ?='approved' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?").bind(status,status,id).run();
  if (!result.meta.changes) return json({ error: "Conta não encontrada." }, 404);
  if(status==="approved"){await binding.prepare("INSERT INTO alegon_user_plans(user_id,requested_plan,active_plan) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_plan=excluded.active_plan,updated_at=CURRENT_TIMESTAMP").bind(id,selectedPlan||"essential",selectedPlan||"essential").run();}
  if (status === "rejected") await binding.prepare("DELETE FROM radar_sessions WHERE user_id=?").bind(id).run();
  return json({ ok: true, status, plan:selectedPlan||"essential" });
}
export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const admin = await adminIdentity(request);
  if (!admin) return json({ error: "Acesso restrito ao superadmin." }, 403);
  const binding = db(); if (!binding) return json({ error: "Banco indisponível." }, 503);
  const id = new URL(request.url).searchParams.get("id") || "";
  const confirmation = await readJsonObject(request, 1024);
  const confirmEmail = typeof confirmation?.confirmEmail === "string" ? confirmation.confirmEmail : "";
  if (!id) return json({ error: "Conta inválida." }, 400);
  if (id === admin.id) return json({ error: "A conta superadmin é protegida contra bloqueio e exclusão." }, 403);
  const target = await binding.prepare("SELECT email FROM radar_users WHERE id=? LIMIT 1").bind(id).first<{ email: string }>();
  if (!target) return json({ error: "Conta não encontrada." }, 404);
  if (target.email.trim().toLowerCase() === configuredAdminEmail()) return json({ error: "A conta superadmin é protegida contra bloqueio e exclusão." }, 403);
  if (confirmEmail !== target.email) return json({ error: "Confirmação de e-mail inválida. A conta não foi excluída." }, 400);
  await binding.batch([
    binding.prepare("DELETE FROM radar_leads WHERE user_id=?").bind(id),
    binding.prepare("DELETE FROM radar_sessions WHERE user_id=?").bind(id),
    binding.prepare("DELETE FROM radar_users WHERE id=? AND lower(email) != ?").bind(id, configuredAdminEmail()),
  ]);
  return json({ ok: true });
}
