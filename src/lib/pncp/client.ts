import { z } from "zod";
import { daySchema, ufSchema } from "../domain";
import { pncpPageSchema, type PncpPage } from "./schema";

export const publicationQuerySchema = z.object({
  from: daySchema,
  to: daySchema,
  uf: ufSchema.default("SP"),
  modality: z.coerce.number().int().min(1).max(13).default(6),
  pageSize: z.coerce.number().int().min(10).max(50).default(50),
  maxPages: z.coerce.number().int().min(1).max(20).default(2),
  maxRecords: z.coerce.number().int().min(1).max(1000).default(100),
}).refine((q) => q.from <= q.to, "A data inicial deve ser anterior à final.")
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 30 * 86400000, "Consulte no máximo 31 dias por importação.");
export type PublicationQuery = z.infer<typeof publicationQuerySchema>;
export class PncpError extends Error {
  constructor(message: string, public readonly kind: "http" | "network" | "schema", public readonly status?: number) {
    super(message);
    this.name = "PncpError";
  }
}
export function publicationUrl(query: PublicationQuery, page: number): string {
  const url = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao");
  url.search = new URLSearchParams({ dataInicial: query.from.replaceAll("-", ""), dataFinal: query.to.replaceAll("-", ""), codigoModalidadeContratacao: String(query.modality), uf: query.uf, pagina: String(page), tamanhoPagina: String(query.pageSize) }).toString();
  return url.toString();
}

export class PncpClient {
  private fetcher: typeof fetch;
  private timeoutMs: number;
  private retries: number;
  private sleep: (ms: number) => Promise<void>;
  constructor(options: { fetcher?: typeof fetch; timeoutMs?: number; retries?: number; sleep?: (ms: number) => Promise<void> } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = z.coerce.number().int().min(1).max(60000).parse(options.timeoutMs ?? process.env.PNCP_TIMEOUT_MS ?? 15000);
    this.retries = z.coerce.number().int().min(0).max(2).parse(options.retries ?? process.env.PNCP_RETRIES ?? 2);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  async page(input: PublicationQuery, page: number): Promise<{ page: PncpPage; url: string; collectedAt: string }> {
    const query = publicationQuerySchema.parse(input);
    z.number().int().min(1).max(20).parse(page);
    const url = publicationUrl(query, page);
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetcher(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: { accept: "application/json" }, cache: "no-store", redirect: "error" });
        if (response.status === 204) return { page: { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: page, paginasRestantes: 0, empty: true }, url, collectedAt: new Date().toISOString() };
        if (!response.ok) {
          const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          if (retryable && attempt < this.retries) {
            await response.body?.cancel();
            const retryAfter = Number(response.headers.get("retry-after"));
            await this.sleep(Math.min(2000, Math.max(250 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
            continue;
          }
          throw new PncpError(`O PNCP respondeu HTTP ${response.status}. Tente novamente mais tarde.`, "http", response.status);
        }
        let raw: unknown;
        try { raw = await response.json(); } catch (error) {
          if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error;
          throw new PncpError("O PNCP retornou um JSON inválido. Nenhum registro desta página foi gravado.", "schema");
        }
        const parsed = pncpPageSchema.safeParse(raw);
        if (!parsed.success || parsed.data.numeroPagina !== page || parsed.data.data.length > query.pageSize) {
          throw new PncpError("A resposta do PNCP não corresponde ao esquema e à paginação verificados. Nenhum registro desta página foi gravado.", "schema");
        }
        return { page: parsed.data, url, collectedAt: new Date().toISOString() };
      } catch (error) {
        if (error instanceof PncpError) throw error;
        if (attempt < this.retries) { await this.sleep(250 * 2 ** attempt); continue; }
        throw new PncpError("Não foi possível consultar o PNCP: falha de rede ou tempo limite excedido. Os dados já coletados foram preservados.", "network");
      }
    }
    throw new PncpError("Não foi possível consultar o PNCP.", "network");
  }
}
