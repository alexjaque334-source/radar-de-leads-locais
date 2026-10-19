export const dynamic = "force-dynamic";
export const runtime = "edge";
// CRM deliberately disabled: no provider-derived leads may be retained or modified.
const unavailable = () => Response.json({ error: "CRM desativado até revisão das licenças das fontes." }, { status: 410, headers: { "Cache-Control": "no-store" } });
export async function GET() { return unavailable(); }
export async function POST() { return unavailable(); }
export async function PATCH() { return unavailable(); }
export async function DELETE() { return unavailable(); }
