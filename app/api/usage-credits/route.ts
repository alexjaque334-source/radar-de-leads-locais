import { requireUser } from "@/app/lib/radar-auth";
import { creditStatus } from "@/app/lib/usage-credits";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: Request) {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  const usage = await creditStatus(actor.id);
  if (!usage) return Response.json({ error: "Saldo de créditos indisponível." }, { status: 503, headers: { "Cache-Control": "no-store, private" } });
  return Response.json(usage, { headers: { "Cache-Control": "no-store, private" } });
}
