import { z } from "zod";
import { pncpIdSchema } from "../domain";

const sourceDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
  return z.iso.date().safeParse(value.slice(0, 10)).success && Number.isFinite(Date.parse(value));
}, "Data inválida na fonte.").nullish();
const optionalText = z.string().nullish();

// Esquema conferido no OpenAPI e em uma resposta HTTP 200 real. Campos extras são mantidos.
export const pncpRecordSchema = z.looseObject({
  numeroControlePNCP: pncpIdSchema,
  objetoCompra: optionalText,
  informacaoComplementar: optionalText,
  orgaoEntidade: z.looseObject({ cnpj: optionalText, razaoSocial: optionalText }).nullish(),
  unidadeOrgao: z.looseObject({ municipioNome: optionalText, ufSigla: optionalText }).nullish(),
  modalidadeNome: optionalText,
  valorTotalEstimado: z.number().finite().nonnegative().nullish(),
  dataPublicacaoPncp: sourceDate,
  dataAberturaProposta: sourceDate,
  dataEncerramentoProposta: sourceDate,
  situacaoCompraNome: optionalText,
  situacaoCompraId: z.union([z.number().int(), z.string()]).nullish(),
  anoCompra: z.number().int().nullish(),
  sequencialCompra: z.number().int().nullish(),
});
export type PncpRecord = z.infer<typeof pncpRecordSchema>;

export const pncpPageSchema = z.object({
  data: z.array(pncpRecordSchema),
  totalRegistros: z.number().int().nonnegative(),
  totalPaginas: z.number().int().nonnegative(),
  numeroPagina: z.number().int().min(1),
  paginasRestantes: z.number().int().nonnegative(),
  empty: z.boolean(),
});
export type PncpPage = z.infer<typeof pncpPageSchema>;

export const archiveSchema = z.object({
  schemaVersion: z.literal(1),
  dataKind: z.enum(["real", "synthetic"]),
  collectedAt: z.iso.datetime({ offset: true }),
  sourceUrl: z.url().refine((v) => {
    const url = new URL(v);
    return url.protocol === "https:" && url.hostname === "pncp.gov.br" && url.pathname.startsWith("/api/consulta/");
  }, "A origem deve ser uma URL HTTPS da API oficial do PNCP."),
  description: z.string().min(1).max(2000),
  records: z.array(pncpRecordSchema).min(1).max(5000),
}).refine((v) => Date.parse(v.collectedAt) <= Date.now() + 60000, "A coleta não pode estar no futuro.");
