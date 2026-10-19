import { env } from "cloudflare:workers";
import { checkRateLimit, db, isRecord, json, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type WhatsAppEnv = {
  SUPERADMIN_EMAIL?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_API_VERSION?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
};

export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const config = env as typeof env & WhatsAppEnv;
  if (!config.SUPERADMIN_EMAIL || user.email.toLowerCase() !== config.SUPERADMIN_EMAIL.trim().toLowerCase()) {
    return json({ error: "O envio oficial está disponível somente para o administrador da conta." }, 403);
  }
  const body = await readJsonObject(request, 4_096); if (!body) return json({ error: "Pedido inválido ou grande demais." }, 400);
  const leadId = typeof body?.leadId === "string" ? body.leadId.slice(0, 120) : "";
  if (!leadId) return json({ error: "Selecione um lead válido." }, 400);
  const binding = db(); if (!binding) return json({ error: "Banco do CRM indisponível." }, 503);
  const row = await binding.prepare("SELECT payload FROM radar_leads WHERE user_id=? AND external_id=? LIMIT 1").bind(user.id,leadId).first<{payload:string}>();
  if (!row) return json({ error: "Lead não encontrado no seu CRM." }, 404);
  let parsedLead: unknown; try { parsedLead = JSON.parse(row.payload); } catch { return json({ error: "Dados do lead inválidos." }, 500); }
  if (!isRecord(parsedLead)) return json({ error: "Dados do lead inválidos." }, 500);
  const lead = parsedLead;
  if (lead.whatsappOptIn !== true || !lead.whatsappConsentDate || !lead.whatsappConsentSource) {
    return json({ error: "Este contato não tem autorização de WhatsApp registrada." }, 422);
  }
  const to = typeof lead.whatsapp === "string" ? lead.whatsapp.replace(/\D/g, "") : "";
  if (!/^\d{10,15}$/.test(to)) return json({ error: "O lead precisa ter um número de WhatsApp explícito e válido no CRM." }, 422);
  const token = config.WHATSAPP_ACCESS_TOKEN, phoneId = config.WHATSAPP_PHONE_NUMBER_ID;
  const version = config.WHATSAPP_GRAPH_API_VERSION, template = config.WHATSAPP_TEMPLATE_NAME, language = config.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
  if (!token || !phoneId || !version || !template) return json({ error: "Integração oficial ainda não configurada. Configure as variáveis WHATSAPP_* no servidor." }, 503);
  if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(phoneId) || !/^[a-zA-Z0-9_]+$/.test(template) || !/^[a-z]{2}_[A-Z]{2}$/.test(language)) {
    return json({ error: "A configuração da API oficial do WhatsApp está inválida." }, 503);
  }
  const limited = await checkRateLimit(request, `whatsapp-send:${user.id}`, 5); if (limited) return limited;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: { name: template, language: { code: language } },
      }),
      signal: controller.signal,
    });
    let rawResult: unknown = {}; try { rawResult = await response.json(); } catch {}
    const result = isRecord(rawResult) ? rawResult : {};
    const messages = Array.isArray(result.messages) ? result.messages.filter(isRecord) : [];
    const firstMessage = messages[0];
    if (!response.ok) return json({ error: "A Meta não aceitou o envio. Confira o número, o modelo aprovado e as permissões da conta." }, response.status === 429 ? 429 : 502);
    return json({ ok: true, status: "accepted", messageId: typeof firstMessage?.id === "string" ? firstMessage.id : null, message: "A Meta aceitou o envio. A entrega final pode ser acompanhada na conta WhatsApp Business." });
  } catch {
    return json({ error: "Não foi possível conectar à API oficial do WhatsApp agora." }, 502);
  } finally { clearTimeout(timeout); }
}
