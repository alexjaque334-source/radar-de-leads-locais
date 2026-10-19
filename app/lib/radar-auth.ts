import { env } from "cloudflare:workers";
import { json } from "./request-safety";
export { isRecord, json, readJsonObject, requireSameOrigin } from "./request-safety";

export const runtime = "edge";
const COOKIE = "radar_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

type D1 = NonNullable<typeof env.DB>;
export type AppUser = { id: string; email: string; status: string };

export function db(): D1 | null { return env.DB ?? null; }
export function cookieHeader(token: string, maxAge = SESSION_SECONDS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function readCookie(request: Request) {
  const raw = request.headers.get("cookie") || "";
  const pair = raw.split(";").map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  return pair ? pair.slice(COOKIE.length + 1) : "";
}
export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64(new Uint8Array(bytes));
}
export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function toBase64(bytes: Uint8Array) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary);
}
function fromBase64(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  let material = new TextEncoder().encode(password);
  // Sites' WebCrypto runtime caps a single PBKDF2 operation at 100,000 rounds.
  // Chain six domain-separated operations to retain a substantial work factor.
  for (let round = 0; round < 6; round++) {
    const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    const roundSalt = new Uint8Array([...salt, round]);
    material = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: roundSalt, iterations: 100_000 }, key, 256));
  }
  return `pbkdf2-chain6$100000$${toBase64(salt)}$${toBase64(material)}`;
}
export async function verifyPassword(password: string, stored: string) {
  try {
    const [scheme, iterationText, saltText, hashText] = stored.split("$");
    if (scheme !== "pbkdf2-chain6" || iterationText !== "100000") return false;
    const salt = fromBase64(saltText); let material = new TextEncoder().encode(password);
    for (let round = 0; round < 6; round++) {
      const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
      material = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array([...salt, round]), iterations: 100_000 }, key, 256));
    }
    const actual = material;
    const expected = fromBase64(hashText); if (actual.length !== expected.length) return false;
    let diff = 0; for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]; return diff === 0;
  } catch { return false; }
}
export async function currentUser(request: Request): Promise<AppUser | null> {
  const binding = db(); const token = readCookie(request); if (!binding || !token) return null;
  const tokenHash = await sha256(token), now = Math.floor(Date.now() / 1000);
  const row = await binding.prepare("SELECT u.id, u.email, u.status FROM radar_sessions s JOIN radar_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1").bind(tokenHash, now).first<AppUser>();
  return row?.status === "approved" ? row : null;
}
export async function requireUser(request: Request): Promise<AppUser | Response> {
  const binding = db(); if (!binding) return json({ error: "Banco do CRM indisponível. Tente novamente em instantes." }, 503);
  const user = await currentUser(request); return user ?? json({ error: "Entre com uma conta aprovada para continuar.", code: "AUTH_REQUIRED" }, 401);
}
export async function checkRateLimit(request: Request, identity: string, limit = 8) {
  const binding = db(); if (!binding) return json({ error: "Banco temporariamente indisponível." }, 503);
  const ip = request.headers.get("cf-connecting-ip") || "unknown", key = await sha256(`${identity}|${ip}`), now = Math.floor(Date.now() / 1000);
  const row = await binding.prepare("SELECT attempts, window_started_at FROM radar_auth_attempts WHERE key=?").bind(key).first<{ attempts: number; window_started_at: number }>();
  if (row && now - row.window_started_at < 900 && row.attempts >= limit) return json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, 429);
  if (!row || now - row.window_started_at >= 900) await binding.prepare("INSERT INTO radar_auth_attempts(key,attempts,window_started_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at").bind(key, 1, now).run();
  else await binding.prepare("UPDATE radar_auth_attempts SET attempts=attempts+1 WHERE key=?").bind(key).run();
  await binding.prepare("DELETE FROM radar_auth_attempts WHERE window_started_at<?").bind(now - 86_400).run();
  return null;
}
