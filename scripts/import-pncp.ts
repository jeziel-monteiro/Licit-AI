import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Store } from "../src/lib/db";
import { recentPeriod } from "../src/lib/format";
import { publicationQuerySchema } from "../src/lib/pncp/client";
import { importPublications } from "../src/lib/pncp/importer";

const { values } = parseArgs({ options: {
  from: { type: "string" }, to: { type: "string" }, uf: { type: "string" }, modality: { type: "string" },
  "page-size": { type: "string" }, "max-pages": { type: "string" }, "max-records": { type: "string" },
  "save-sample": { type: "string" }, help: { type: "boolean", short: "h" },
} });
if (values.help) {
  console.log("npm run import:pncp -- --from AAAA-MM-DD --to AAAA-MM-DD --uf SP --modality 6 --page-size 50 --max-pages 2 --max-records 100 [--save-sample data/pncp-sample.json]");
  process.exit(0);
}
const period = recentPeriod();
const store = new Store();
try {
  const query = publicationQuerySchema.parse({
    from: values.from ?? period.from, to: values.to ?? period.to,
    uf: values.uf ?? process.env.PNCP_UF ?? "SP", modality: values.modality ?? process.env.PNCP_MODALITY ?? 6,
    pageSize: values["page-size"] ?? process.env.PNCP_PAGE_SIZE ?? 50,
    maxPages: values["max-pages"] ?? process.env.PNCP_MAX_PAGES ?? 2,
    maxRecords: values["max-records"] ?? process.env.PNCP_MAX_RECORDS ?? 100,
  });
  const run = await importPublications(store, query);
  console.log(JSON.stringify(run, null, 2));
  if (values["save-sample"] && run.processed > 0) {
    // Uma página só: todos os registros da amostra compartilham URL e instante da coleta reais.
    const rows = store.db.prepare("SELECT raw_json,source_url,collected_at FROM import_records WHERE import_id=? AND source_url=(SELECT source_url FROM import_records WHERE import_id=? ORDER BY rowid LIMIT 1) ORDER BY rowid LIMIT 50").all(run.id, run.id);
    const path = values["save-sample"];
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, dataKind: "real", collectedAt: String(rows[0].collected_at), sourceUrl: String(rows[0].source_url), description: "Amostra histórica real do PNCP, preservada para demonstração offline. Não representa a situação atual nem todas as contratações do período.", records: rows.map((row) => JSON.parse(String(row.raw_json))) }, null, 2) + "\n");
    console.log(`Amostra real preservada: ${rows.length} registros em ${path}`);
  }
  if (run.status !== "success") process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { store.close(); }
