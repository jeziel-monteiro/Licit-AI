import { readFileSync } from "node:fs";
import { Store } from "../src/lib/db";
import { importArchive } from "../src/lib/pncp/importer";

const filename = process.argv[2];
if (!filename) { console.error("Uso: npm run import:file -- caminho/arquivo.json"); process.exit(1); }
const store = new Store();
try {
  let data: unknown;
  try { data = JSON.parse(readFileSync(filename, "utf8")); }
  catch {
    const run = store.startImport("file", { filename });
    console.error(JSON.stringify(store.finishImport(run.id, { error: "Não foi possível ler o arquivo ou o JSON é inválido." }), null, 2));
    process.exitCode = 1;
  }
  if (data !== undefined) {
    const run = importArchive(store, data, filename);
    console.log(JSON.stringify(run, null, 2));
    if (run.status !== "success") process.exitCode = 1;
  }
} finally { store.close(); }
