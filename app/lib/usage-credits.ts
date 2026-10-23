import {subscription} from "./subscriptions";
import { db } from "./radar-auth";

export const MONTHLY_CREDITS = 700;
async function userLimit(userId:string){const database=db();if(!database)throw Error("DB_MISSING");const row=await database.prepare("SELECT email FROM radar_users WHERE id=?").bind(userId).first<{email:string}>();if(!row)throw Error("USER_MISSING");const p=await subscription({id:userId,email:row.email});return p.active==="premium"?3500:p.active==="pro"?1400:MONTHLY_CREDITS;}
// Server-only QA exception; compare the authenticated database account, never client-provided email.
export async function isUnlimitedTestAccount(userId: string): Promise<boolean> {
  const database = db();
  if (!database) return false;
  try {
    const user = await database.prepare("SELECT email,status FROM radar_users WHERE id=? LIMIT 1").bind(userId).first<{email:string;status:string}>();
    return user?.status === "approved" && user.email.trim().toLowerCase() === "alexjak334@gmail.com";
  } catch { return false; }
}
export const CREDIT_COST = {
  discover: 10,
  details: 7,
  geocode: 2,
  generate: 15,
  refine: 15,
} as const;
export type CreditOperation = keyof typeof CREDIT_COST;

export async function reserveCredits(userId: string, operation: CreditOperation) {
  if (await isUnlimitedTestAccount(userId)) return { ok: true, cost: 0 };
  const database = db();
  if (!database) return { error: "Controle de créditos indisponível.", status: 503 };
  const month = new Date().toISOString().slice(0, 7);
  const amount = CREDIT_COST[operation];
  try {
    const result = await database.prepare(
      `INSERT INTO alegon_usage_credits (user_id, month, used, ${operation})
       VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id,month) DO UPDATE SET
         used=used+excluded.used, ${operation}=${operation}+1
       WHERE used+excluded.used<=?`
    ).bind(userId, month, amount, await userLimit(userId)).run();
    if (!result.meta?.changes) return {
      error: "Créditos mensais esgotados. A operação não foi enviada ao provedor.",
      code: "CREDITS_EXHAUSTED",
      status: 429,
    };
    return { ok: true, cost: amount };
  } catch {
    return { error: "Não foi possível validar os créditos. Nenhuma consulta foi enviada ao provedor.", status: 503 };
  }
}

export async function refundCredits(userId: string, operation: CreditOperation) {
  if (await isUnlimitedTestAccount(userId)) return;
  const database = db();
  if (!database) return;
  const month = new Date().toISOString().slice(0, 7);
  const amount = CREDIT_COST[operation];
  try {
    await database.prepare(
      `UPDATE alegon_usage_credits SET used=used-?, ${operation}=${operation}-1
       WHERE user_id=? AND month=? AND used>=? AND ${operation}>0`
    ).bind(amount,userId,month,amount).run();
  } catch { /* A reconciliação operacional pode ser revisada pelo administrador. */ }
}

export async function creditStatus(userId: string) {
  if (await isUnlimitedTestAccount(userId)) return { month: new Date().toISOString().slice(0,7), unlimited: true, limit: 700, used: 0, remaining: 700, operations: { searches: 0, details: 0, geocodes: 0, sitesGenerated: 0, aiEdits: 0 }, costs: CREDIT_COST, note: "Conta de testes isenta das cotas comerciais." };
  const database = db();
  if (!database) return null;
  const month = new Date().toISOString().slice(0, 7);
  try {
    const row = await database.prepare(
      "SELECT used,discover,details,geocode,generate,refine FROM alegon_usage_credits WHERE user_id=? AND month=?"
    ).bind(userId, month).first<{ used:number; discover:number; details:number; geocode:number; generate:number; refine:number }>();
    const used = row?.used ?? 0;const limit=await userLimit(userId);
    return {
      month, limit, used, remaining: Math.max(0, limit-used),
      operations: { searches: row?.discover ?? 0, details: row?.details ?? 0, geocodes: row?.geocode ?? 0, sitesGenerated: row?.generate ?? 0, aiEdits: row?.refine ?? 0 },
      costs: CREDIT_COST,
      note: "Créditos representam a franquia interna da plataforma; os tokens reais da DeepSeek têm um limite independente.",
    };
  } catch { return null; }
}
