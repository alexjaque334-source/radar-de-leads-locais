import { reserveCredits } from "@/app/lib/usage-credits";
import { extractTomtomContacts } from "@/app/lib/tomtom-contacts";
import { env } from "cloudflare:workers";
import { checkRateLimit, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, private" } });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const limited = await checkRateLimit(request, `tomtom-details:${user.id}`, 12); if (limited) return limited;
  const key = env.TOMTOM_API_KEY;
  if (!key) return json({ error: "A chave TomTom não está configurada." }, 503);
  const input = await readJsonObject(request, 2048);
  if (!input) return json({ error: "Pedido inválido." }, 400);
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!/^[a-zA-Z0-9_-]{8,160}$/.test(id)) return json({ error: "Identificador de estabelecimento inválido." }, 400);
  const lon = Number(input.lon), lat = Number(input.lat);
  const validOrigin = Number.isFinite(lon) && Number.isFinite(lat) && lon >= -75 && lon <= -30 && lat >= -35 && lat <= 6;
  const url = new URL(`https://api.tomtom.com/maps/orbis/places/details/pois/${encodeURIComponent(id)}`);
  if (validOrigin) url.searchParams.set("origin", `${lon},${lat}`);
  const trackingId = crypto.randomUUID();
  try {
    const credits = await reserveCredits(user.id, "details");
    if ("error" in credits) return json({ error: credits.error, code: "CREDITS_EXHAUSTED" }, credits.status);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "TomTom-Api-Key": key,
        "TomTom-Api-Version": "3",
        "Attributes": "id,type,title,position,address,contacts,poiTypes",
        "Accept-Language": "pt-BR",
        "Session-Id": crypto.randomUUID(),
        "Tracking-Id": trackingId,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const error = response.status === 401 || response.status === 403 ? "A chave não tem acesso a Details."
        : response.status === 404 ? "Estabelecimento não encontrado."
        : response.status === 429 ? "Limite de consultas TomTom atingido."
        : "A TomTom não conseguiu fornecer os detalhes.";
      return json({ error, providerStatus: response.status, trackingId }, response.status === 429 ? 429 : 502);
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Resposta inesperada da TomTom." }, 502);
    const p = data as Record<string, unknown>;
    const contacts = extractTomtomContacts(p.contacts);
    const safeName = typeof p.title === "string" ? p.title.slice(0,180) : "";
    return json({ id, name: safeName, phones: contacts.phones, websites: contacts.websites, temporary: true, trackingId });
  } catch {
    return json({ error: "Falha de comunicação com TomTom Details.", trackingId }, 502);
  }
}
