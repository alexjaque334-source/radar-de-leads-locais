export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, private");
  return Response.json(data, { status, headers });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request, maxBytes = 16_384): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) return null;
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return json({ error: "Origem ausente. Recarregue a página e tente novamente." }, 403);
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Origem inválida." }, 403);
  } catch {
    return json({ error: "Origem inválida." }, 403);
  }
  return null;
}
