import { db, isRecord, json, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
const MAX_LEADS = 100;
const FIELD_LIMITS: Record<string, number> = { name: 180, category: 120, city: 100, state: 60, address: 320, phone: 80, whatsapp: 120, email: 180, site: 500, instagram: 300, facebook: 300, menu: 500, source: 60, sourceUrl: 500, googleUrl: 500, priority: 40, confidence: 120 };
function cleanLead(input: unknown) {
  const source = isRecord(input) ? input : {};
  const lead: Record<string, string | boolean | number | null> = {};
  for (const [field, max] of Object.entries(FIELD_LIMITS)) lead[field] = typeof source[field] === "string" ? source[field].trim().slice(0, max) : "";
  lead.food = Boolean(source.food); lead.distance = Number.isFinite(Number(source.distance)) ? Math.max(0, Math.min(Number(source.distance), 100_000)) : null;
  lead.score = Number.isFinite(Number(source.score)) ? Math.max(0, Math.min(Math.round(Number(source.score)), 100)) : null;
  return lead;
}
export async function GET(request: Request) {
  const user = await requireUser(request); if (user instanceof Response) return user;
  const binding = db()!;
  const rows = await binding.prepare("SELECT id,external_id,payload,stage,notes,follow_up,created_at,updated_at FROM radar_leads WHERE user_id=? ORDER BY updated_at DESC LIMIT 5000").bind(user.id).all<{id:string;external_id:string;payload:string;stage:string;notes:string;follow_up:string;created_at:string;updated_at:string}>();
  const leads = (rows.results || []).flatMap(row => { try { const payload: unknown = JSON.parse(row.payload); return isRecord(payload) ? [{ ...payload, id: row.external_id, crmId: row.id, stage: row.stage, notes: row.notes, followUp: row.follow_up, createdAt: row.created_at, updatedAt: row.updated_at }] : []; } catch { return []; } });
  return json({ leads });
}
export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const binding = db()!;
  const body = await readJsonObject(request, 1_000_000); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  if (!Array.isArray(body.leads) || body.leads.length < 1 || body.leads.length > MAX_LEADS) return json({ error: `Selecione de 1 a ${MAX_LEADS} leads por vez.` }, 400);
  const prepared: Array<{ id:string; externalId:string; payload:string; stage:string; notes:string; followUp:string }> = [];
  for (const raw of body.leads) {
    const item = isRecord(raw) ? raw : {};
    const lead = cleanLead(item), osmId = typeof item.id === "string" ? item.id : "", sourceUrl = typeof lead.sourceUrl === "string" ? lead.sourceUrl : "";
    if (!lead.name || (lead.source !== "Manual" && (!/^(node|way|relation)\/\d+$/.test(osmId) || lead.source !== "OpenStreetMap" || !/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(sourceUrl)))) return json({ error: "O CRM só armazena registros públicos verificáveis do OpenStreetMap. Resultados temporários de outras fontes não são elegíveis." }, 422);
    const manual = lead.source === "Manual";
    const externalId = manual ? `manual/${crypto.randomUUID()}` : osmId;
    if (manual) { lead.sourceUrl = ""; lead.googleUrl = ""; }
    const stage = typeof item.stage === "string" && ["novo","contato","conversa","reuniao","proposta","negociacao","ganho","perdido"].includes(item.stage) ? item.stage : "novo";
    const notes = typeof item.notes === "string" ? item.notes.slice(0, 5000) : "";
    const followUp = typeof item.followUp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.followUp) ? item.followUp : "";
    prepared.push({ id: crypto.randomUUID(), externalId, payload: JSON.stringify({ ...lead, id: externalId, source: manual ? "Manual" : "OpenStreetMap" }), stage, notes, followUp });
  }
  const now = new Date().toISOString();
  const statements = prepared.map(item => binding.prepare("INSERT INTO radar_leads(id,user_id,source,external_id,payload,stage,notes,follow_up,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,external_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(item.id,user.id,item.externalId.startsWith("manual/")?"Manual":"OpenStreetMap",item.externalId,item.payload,item.stage,item.notes,item.followUp,now,now));
  await binding.batch(statements);
  return json({ ok: true, count: prepared.length, retained: true }, 201);
}
export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const binding = db()!;
  const body = await readJsonObject(request, 8_192); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  const id = typeof body.id === "string" ? body.id.slice(0, 120) : "", stage = typeof body.stage === "string" && ["novo","contato","conversa","reuniao","proposta","negociacao","ganho","perdido"].includes(body.stage) ? body.stage : "novo";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : "", followUp = typeof body.followUp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.followUp) ? body.followUp : "";
  if (!id) return json({ error: "Lead inválido." }, 400);
  const current = await binding.prepare("SELECT payload FROM radar_leads WHERE user_id=? AND external_id=? LIMIT 1").bind(user.id,id).first<{payload:string}>();
  if (!current) return json({ error: "Lead não encontrado." }, 404);
  let payload: Record<string, unknown>; try { payload = JSON.parse(current.payload); } catch { return json({ error: "Dados do lead inválidos." }, 500); }
  if (typeof body.whatsappOptIn === "boolean") {
    const consentDate = typeof body.whatsappConsentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.whatsappConsentDate) ? body.whatsappConsentDate : "";
    const consentSource = typeof body.whatsappConsentSource === "string" ? body.whatsappConsentSource.trim().slice(0, 300) : "";
    if (body.whatsappOptIn && (!consentDate || !consentSource || consentDate > new Date().toISOString().slice(0,10))) return json({ error: "Registre a data e a origem da autorização antes de marcar o opt-in." }, 400);
    payload.whatsappOptIn = body.whatsappOptIn;
    payload.whatsappConsentDate = body.whatsappOptIn ? consentDate : "";
    payload.whatsappConsentSource = body.whatsappOptIn ? consentSource : "";
  }
  const result = await binding.prepare("UPDATE radar_leads SET payload=?,stage=?,notes=?,follow_up=?,updated_at=? WHERE user_id=? AND external_id=?").bind(JSON.stringify(payload),stage,notes,followUp,new Date().toISOString(),user.id,id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "Lead não encontrado." }, 404);
}
export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const id = new URL(request.url).searchParams.get("id") || ""; if (!id) return json({ error: "Informe o lead." }, 400);
  const result = await db()!.prepare("DELETE FROM radar_leads WHERE user_id=? AND external_id=?").bind(user.id,id.slice(0,120)).run();
  return result.meta.changes ? json({ ok:true }) : json({ error: "Lead não encontrado." }, 404);
}
