import { db, hashPassword, json, cookieHeader, randomToken, sha256, verifyPassword, requireSameOrigin, checkRateLimit } from "@/app/lib/radar-auth";
import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const binding = db(); if (!binding) return json({ error: "Login indisponível: banco ainda não provisionado." }, 503);
  let body: any; try { body = await request.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "", password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 128) return json({ error: "Confira e-mail e senha." }, 400);
  const limited = await checkRateLimit(request, `login:${email}`, 8); if (limited) return limited;
  const config = env as typeof env & { SUPERADMIN_EMAIL?: string; SUPERADMIN_PASSWORD?: string };
  const superadminEmail = config.SUPERADMIN_EMAIL?.trim().toLowerCase() || "";
  const superadminPassword = config.SUPERADMIN_PASSWORD || "";
  let row = await binding.prepare("SELECT id,email,password_hash,status FROM radar_users WHERE email=? LIMIT 1").bind(email).first<{id:string;email:string;password_hash:string;status:string}>();
  if (email === superadminEmail && superadminPassword) {
    const provided = new TextEncoder().encode(password), expected = new TextEncoder().encode(superadminPassword);
    let diff = provided.length ^ expected.length;
    for (let i = 0; i < Math.max(provided.length, expected.length); i++) diff |= (provided[i] || 0) ^ (expected[i] || 0);
    if (diff !== 0) return json({ error: "E-mail ou senha incorretos." }, 401);
    const id = row?.id || crypto.randomUUID();
    const passwordHash = await hashPassword(superadminPassword);
    await binding.prepare("INSERT INTO radar_users(id,email,password_hash,status,approved_at) VALUES(?,?,?,'approved',CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,status='approved',approved_at=COALESCE(radar_users.approved_at,CURRENT_TIMESTAMP)").bind(id, superadminEmail, passwordHash).run();
    row = await binding.prepare("SELECT id,email,password_hash,status FROM radar_users WHERE email=? LIMIT 1").bind(superadminEmail).first<{id:string;email:string;password_hash:string;status:string}>();
  } else if (!row || !(await verifyPassword(password, row.password_hash))) {
    return json({ error: "E-mail ou senha incorretos." }, 401);
  }
  if (!row) return json({ error: "Não foi possível iniciar a sessão." }, 500);
  if (row.status === "pending") return json({ error: "Sua conta aguarda autorização do administrador.", code: "ACCOUNT_PENDING" }, 403);
  if (row.status !== "approved") return json({ error: "Esta conta não está autorizada. Fale com o administrador.", code: "ACCOUNT_DISABLED" }, 403);
  const token = randomToken(), now = Math.floor(Date.now() / 1000), expires = now + 604_800;
  await binding.prepare("DELETE FROM radar_sessions WHERE expires_at<=?").bind(now).run();
  await binding.prepare("INSERT INTO radar_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await sha256(token), row.id, expires, now).run();
  return json({ ok: true, user: { email: row.email } }, 200, { "Set-Cookie": cookieHeader(token) });
}
