import {validPlan} from "@/app/lib/subscriptions";
import { db, hashPassword, json, requireSameOrigin, checkRateLimit, readJsonObject } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const binding = db(); if (!binding) return json({ error: "Cadastro indisponível: banco ainda não provisionado." }, 503);
  const body = await readJsonObject(request, 2_048); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const selectedPlan=validPlan(body.plan)?body.plan:"essential";
  const password = typeof body.password === "string" ? body.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json({ error: "A senha precisa ter ao menos 10 caracteres, incluindo letras e números." }, 400);
  const limited = await checkRateLimit(request, `register:${email}`, 5); if (limited) return limited;
  try {
    const id = crypto.randomUUID(), passwordHash = await hashPassword(password);
    await binding.batch([binding.prepare("INSERT INTO radar_users(id,email,password_hash,status) VALUES(?,?,?,'pending')").bind(id,email,passwordHash),binding.prepare("INSERT INTO alegon_user_plans(user_id,requested_plan,active_plan) VALUES(?, ?, 'essential')").bind(id,selectedPlan)]);
    return json({ ok: true, status: "pending", requestedPlan:selectedPlan, message: "Conta criada. O administrador precisa autorizar seu acesso." }, 201);
  } catch {
    return json({ error: "Não foi possível concluir o cadastro. Se este e-mail já está cadastrado, entre ou aguarde a aprovação." }, 409);
  }
}
