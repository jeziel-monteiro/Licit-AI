import { z } from "zod";
import { Store, type ImportRun } from "../db";
import { PncpClient, publicationQuerySchema, type PublicationQuery } from "./client";
import { archiveSchema } from "./schema";

export async function importPublications(store: Store, input: PublicationQuery, client = new PncpClient()): Promise<ImportRun> {
  const query = publicationQuerySchema.parse(input);
  const run = store.startImport("live", query);
  let limited = false;
  try {
    let processed = 0;
    for (let page = 1; page <= query.maxPages && processed < query.maxRecords; page++) {
      const response = await client.page(query, page);
      const records = response.page.data.slice(0, query.maxRecords - processed);
      store.ingestPage(run.id, records, { sourceUrl: response.url, collectedAt: response.collectedAt, ingestionKind: "live", dataKind: "real" }, { fetched: response.page.data.length, totalSource: response.page.totalRegistros });
      processed += records.length;
      limited = records.length < response.page.data.length || response.page.paginasRestantes > 0;
      if (response.page.empty || response.page.data.length === 0 || response.page.paginasRestantes === 0) break;
    }
    return store.finishImport(run.id, { limited });
  } catch (error) {
    return store.finishImport(run.id, { error: error instanceof Error ? error.message : "Falha inesperada na importação.", limited: true });
  }
}

export function importArchive(store: Store, raw: unknown, filename: string): ImportRun {
  const run = store.startImport("file", { filename });
  try {
    const archive = archiveSchema.parse(raw);
    store.ingestPage(run.id, archive.records, { sourceUrl: archive.sourceUrl, collectedAt: archive.collectedAt, ingestionKind: "archive", dataKind: archive.dataKind }, { fetched: archive.records.length, totalSource: null });
    return store.finishImport(run.id);
  } catch (error) {
    const message = error instanceof z.ZodError ? `Arquivo incompatível com o esquema verificado: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}` : error instanceof Error ? error.message : "Falha na leitura do arquivo.";
    return store.finishImport(run.id, { error: message });
  }
}
