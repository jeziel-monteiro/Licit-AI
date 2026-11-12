import { createHash } from "node:crypto";
import { searchText, type Opportunity } from "../domain";
import { pncpRecordSchema } from "./schema";

export type IngestionContext = { sourceUrl: string; collectedAt: string; ingestionKind: "live" | "archive"; dataKind: "real" | "synthetic" };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function normalize(raw: unknown, context: IngestionContext): Omit<Opportunity, "saved" | "note"> & { rawJson: string; searchText: string } {
  const record = pncpRecordSchema.parse(raw);
  const [cnpj, sequence, year] = record.numeroControlePNCP.match(/^(\d{14})-1-(\d{6})\/(\d{4})$/)!.slice(1);
  const text = (value: string | null | undefined) => value?.trim() || null;
  const description = text(record.objetoCompra);
  const agency = text(record.orgaoEntidade?.razaoSocial);
  const city = text(record.unidadeOrgao?.municipioNome);
  const collectedAt = new Date(context.collectedAt).toISOString();
  return {
    id: record.numeroControlePNCP,
    description,
    additionalInformation: text(record.informacaoComplementar),
    agency,
    city,
    uf: text(record.unidadeOrgao?.ufSigla),
    modality: text(record.modalidadeNome),
    estimatedValue: record.valorTotalEstimado ?? null,
    publishedAt: record.dataPublicacaoPncp ?? null,
    proposalsStartAt: record.dataAberturaProposta ?? null,
    proposalsEndAt: record.dataEncerramentoProposta ?? null,
    sourceStatus: text(record.situacaoCompraNome),
    officialUrl: `https://pncp.gov.br/app/editais/${cnpj}/${year}/${Number(sequence)}`,
    ...context,
    collectedAt,
    firstCollectedAt: collectedAt,
    recordHash: createHash("sha256").update(canonical(raw)).digest("hex"),
    rawJson: JSON.stringify(raw),
    searchText: searchText([description, agency, city, record.numeroControlePNCP].filter(Boolean).join(" ")),
  };
}
