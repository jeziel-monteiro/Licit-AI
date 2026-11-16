import { getStore } from "@/lib/server/store";
import { createAdherenceService } from "@/lib/server/adherence";
import { SelectionSummaryService, summaryCsv } from "@/lib/summary";

export const runtime = "nodejs";
export async function GET() {
  const { record, stale } = new SelectionSummaryService(getStore(), createAdherenceService()).latest();
  if (!record || stale) return new Response("Atualize o resumo antes de exportar.", { status: 409 });
  return new Response(summaryCsv(record), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="licitai-resumo.csv"', "Cache-Control": "no-store" } });
}
