import { getStore } from "@/lib/server/store";
import { parseRouteId } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) return Response.json({ error: "Identificador inválido." }, { status: 400 });
  const record = getStore().rawRecord(id);
  if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
  return new Response(JSON.stringify(record, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
