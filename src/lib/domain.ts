import { z } from "zod";
z.config(z.locales.pt());

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export const ufSchema = z.enum(UFS);
export const daySchema = z.iso.date();
export const pncpIdSchema = z.string().regex(/^\d{14}-1-\d{6}\/\d{4}$/, "Identificador PNCP inválido.");
export function parseRouteId(value: unknown): string | null {
  try {
    // Páginas e Route Handlers podem entregar parâmetros com níveis distintos de decodificação.
    const parsed = pncpIdSchema.safeParse(typeof value === "string" ? decodeURIComponent(value) : value);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
const termsSchema = z.array(z.string().trim().min(1).max(100)).max(30);
export const profileInputSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(150),
  description: z.string().trim().min(10, "Descreva os produtos e serviços (mínimo de 10 caracteres).").max(4000),
  interestTerms: termsSchema,
  exclusionTerms: termsSchema,
  uf: ufSchema,
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type Profile = ProfileInput & { version: number; updatedAt: string };

export const DEMO_PROFILE: ProfileInput = {
  name: "Horizonte Informática",
  description: "Empresa que vende computadores, monitores e periféricos. Busca aquisições de equipamentos em São Paulo. Não oferece manutenção nem locação.",
  interestTerms: ["computador", "notebook", "monitor", "periféricos", "informática"],
  exclusionTerms: ["manutenção", "locação"],
  uf: "SP",
};

export type Opportunity = {
  id: string;
  description: string | null;
  additionalInformation: string | null;
  agency: string | null;
  city: string | null;
  uf: string | null;
  modality: string | null;
  estimatedValue: number | null;
  publishedAt: string | null;
  proposalsStartAt: string | null;
  proposalsEndAt: string | null;
  sourceStatus: string | null;
  officialUrl: string;
  sourceUrl: string;
  collectedAt: string;
  firstCollectedAt: string;
  recordHash: string;
  ingestionKind: "live" | "archive";
  dataKind: "real" | "synthetic";
  saved: boolean;
  note: string | null;
};

export const filterSchema = z.object({
  q: z.string().trim().max(200).default(""),
  sector: z.enum(["", "it"]).default("it"),
  uf: z.union([ufSchema, z.literal("")]).default(""),
  from: z.union([daySchema, z.literal("")]).default(""),
  to: z.union([daySchema, z.literal("")]).default(""),
  min: z.union([z.literal(""), z.coerce.number().finite().min(0).max(1e15)]).default(""),
  max: z.union([z.literal(""), z.coerce.number().finite().min(0).max(1e15)]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine((f) => !f.from || !f.to || f.from <= f.to, { message: "A data inicial deve ser anterior à final.", path: ["from"] })
  .refine((f) => f.min === "" || f.max === "" || f.min <= f.max, { message: "O valor mínimo deve ser menor ou igual ao máximo.", path: ["min"] });
export type Filters = z.infer<typeof filterSchema>;

export function searchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

// Busca lexical explícita: "monitor" não deve coincidir com "monitoramento".
export function hasItTerms(description: string): boolean {
  return /(?:^|[^a-z0-9])(?:microcomputador(?:es)?|computador(?:es)?|notebooks?|monitor(?:es)?|periferic[oa]s?|informatica|impressoras?)(?:$|[^a-z0-9])/.test(searchText(description));
}

export function isHistorical(item: Pick<Opportunity, "collectedAt" | "ingestionKind">, now = new Date()): boolean {
  return item.ingestionKind === "archive" || now.getTime() - Date.parse(item.collectedAt) > 7 * 86400000;
}
