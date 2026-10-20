import { env } from "cloudflare:workers";
import { checkRateLimit, isRecord, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}
function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value)) {
    for (const key of ["value", "url", "address"]) if (typeof value[key] === "string") return value[key] as string;
  }
  return "";
}
function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export async function GET(request: Request) {
  const user = await requireUser(request); if (user instanceof Response) return user;
  return json({ configured: Boolean(env.TOMTOM_API_KEY) });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const user = await requireUser(request); if (user instanceof Response) return user;
  const limited = await checkRateLimit(request, `tomtom:${user.id}`, 30); if (limited) return limited;
  const key = env.TOMTOM_API_KEY;
  if (!key) return json({ error: "TomTom Places ainda não está conectado.", code: "TOMTOM_NOT_CONFIGURED" }, 503);

  const input = await readJsonObject(request, 8_192);
  if (!input) return json({ error: "Pedido de busca inválido ou grande demais." }, 400);
  const city = typeof input.city === "string" ? input.city.trim().slice(0, 90) : "";
  const state = typeof input.state === "string" ? input.state.trim().slice(0, 40) : "";
  const neighborhood = typeof input.neighborhood === "string" ? input.neighborhood.trim().slice(0, 90) : "";
  const category = typeof input.category === "string" ? input.category.trim().slice(0, 80) : "";
  const categoryKey = typeof input.categoryKey === "string" ? input.categoryKey : "";
  const requestedLimit = Number(input.limit);
  const maxResults = [10, 20, 35].includes(requestedLimit) ? requestedLimit : 20;
  const searchTerms: Record<string, string> = {
    restaurant: "restaurant", pizza: "pizzeria", fast_food: "hamburger restaurant", cafe: "cafe", bar: "bar",
    bakery: "bakery", gym: "fitness center", clinic: "clinic", dentist: "dentist", beauty: "beauty salon",
    barber: "barber", pet: "pet shop", clothing: "clothing shop", supermarket: "supermarket",
    car_repair: "car repair", pharmacy: "pharmacy",
  };
  const poiTypes: Record<string, string[]> = {
    restaurant: ["restaurant"], pizza: ["pizzeria"], fast_food: ["fast_food", "hamburger_restaurant"],
    cafe: ["cafe", "coffee_shop"], bar: ["bar", "pub"], gym: ["fitness_center", "fitness_club_and_center"],
    clinic: ["clinic", "doctor"], dentist: ["dentist"], beauty: ["beauty_salon", "hairdresser", "nail_salon"],
    barber: ["hairdresser"], pet: ["pet_supplies", "animal_service", "veterinary"], clothing: ["clothing_shop"],
    supermarket: ["supermarket", "grocery_store"], car_repair: ["vehicle_repair", "car_repair_and_service"],
    pharmacy: ["pharmacy", "drug_store"],
  };
  const center = input.center as Record<string, unknown> | undefined;
  const lat = Number(center?.lat), lon = Number(center?.lon);
  if (!city || !state || !category || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -35 || lat > 6 || lon < -75 || lon > -30) {
    return json({ error: "Informe cidade, estado, segmento e uma localização válida no Brasil." }, 400);
  }

  const bounds = input.bounds as Record<string, unknown> | undefined;
  const south = Number(bounds?.south), north = Number(bounds?.north), west = Number(bounds?.west), east = Number(bounds?.east);
  const validBounds = [south, north, west, east].every(Number.isFinite) && south < north && west < east && south >= -35 && north <= 6 && west >= -75 && east <= -30;
  const body: Record<string, unknown> = {
    query: `${searchTerms[categoryKey] || category} em ${neighborhood ? `${neighborhood}, ` : ""}${city}, ${state}, Brasil`,
    origin: { type: "point", coordinates: [lon, lat] },
    maxResults,
    filters: { types: ["poi"], countryCodesIso2: ["BR"] },
  };
  if (poiTypes[categoryKey]) (body.filters as Record<string, unknown>).poiTypes = poiTypes[categoryKey];
  if (validBounds) (body.filters as Record<string, unknown>).geometry = { type: "rectangle", coordinates: [west, south, east, north] };
  const attrs = "results(id,type,title,subtitles,distanceInMeters,position,address,contacts,poiTypes)";
  const trackingId = crypto.randomUUID();

  try {
    const response = await fetch("https://api.tomtom.com/maps/orbis/places/discover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TomTom-Api-Key": key,
        "TomTom-Api-Version": "3",
        "Session-Id": crypto.randomUUID(),
        "Tracking-Id": trackingId,
        "Accept-Language": "pt-BR",
        "Attributes": attrs,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const responseText = await response.text();
    let rawResult: unknown = {};
    try { rawResult = responseText ? JSON.parse(responseText) : {}; } catch { /* A API pode retornar texto sem JSON. */ }
    const result = isRecord(rawResult) ? rawResult : {};
    if (!response.ok) {
      const upstreamError = isRecord(result.error) ? result.error : {};
      const upstreamCode = typeof upstreamError.code === "string" ? upstreamError.code.slice(0, 80) : "";
      // Log only provider status/code and our request ID; never the API key or search terms.
      console.error("TomTom Places rejected request", { status: response.status, code: upstreamCode, trackingId });
      if (response.status === 401 || response.status === 403) {
        return json({ error: "A TomTom recusou a chave ou o acesso ao Places Search. Confira se TOMTOM_API_KEY é uma chave ativa com o produto Places Search habilitado.", code: "TOMTOM_ACCESS_DENIED", trackingId }, 502);
      }
      if (response.status === 400) {
        return json({ error: "A TomTom rejeitou os parâmetros desta busca. Identificador para diagnóstico: " + trackingId + ".", code: "TOMTOM_INVALID_REQUEST", trackingId }, 502);
      }
      if (response.status === 429) {
        return json({ error: "A TomTom limitou temporariamente as consultas. Aguarde um pouco e tente novamente.", code: "TOMTOM_RATE_LIMITED", trackingId }, 429);
      }
      return json({ error: "A TomTom Places respondeu com erro (HTTP " + response.status + "). Identificador: " + trackingId + ".", code: "TOMTOM_PLACES_ERROR", trackingId }, 502);
    }
    const places = objectArray(result.results).map((p) => {
      const a = isRecord(p.address) ? p.address : {};
      const contacts = objectArray(p.contacts);
      const phone = contacts.flatMap(x => (Array.isArray(x.phones) ? x.phones : x.phone ? [x.phone] : [])).map(v => { if(typeof v==="string")return v; if(isRecord(v))return textValue(v)||textValue(v.number)||textValue(v.phoneNumber);return ""; }).find(Boolean) || "";
      const website = contacts.flatMap(x => (Array.isArray(x.websites) ? x.websites : x.website ? [x.website] : [])).map(v=>isRecord(v)?textValue(v)||textValue(v.website):textValue(v)).find(Boolean) || "";
      const pos = isRecord(p.position) ? p.position : {};
      const coordinates = Array.isArray(pos.coordinates) ? pos.coordinates : [];
      const poiTypes = objectArray(p.poiTypes);
      const title = typeof p.title === "string" ? p.title : "";
      return {
        id: textValue(p.id) || `${title || "place"}-${textValue(pos.lat)}-${textValue(pos.lon)}`,
        name: title || "Nome não informado pela TomTom",
        category: textValue(poiTypes[0]?.name) || category,
        address: [a.street, a.houseNumber, a.municipalitySubdivision, a.municipality, a.countrySubdivision, a.postalCode].map(textValue).filter(Boolean).join(", ") || "Endereço não informado pela TomTom",
        phone, site: website, lat: Number.isFinite(Number(coordinates[1])) ? Number(coordinates[1]) : null,
        lon: Number.isFinite(Number(coordinates[0])) ? Number(coordinates[0]) : null,
        distance: Number.isFinite(Number(p.distanceInMeters)) ? Number(p.distanceInMeters) : null,
      };
    });
    return json({ places, source: "TomTom Places", temporary: true });
  } catch {
    return json({ error: "Não foi possível alcançar TomTom Places agora." }, 502);
  }
}
