import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_PROFILE, filterSchema, hasItTerms, profileInputSchema, searchText, type Filters, type Opportunity, type Profile, type ProfileInput } from "./domain";
import { normalize, type IngestionContext } from "./pncp/normalize";

export type ImportRun = {
  id: string; kind: "live" | "file"; status: "running" | "success" | "partial" | "failed";
  startedAt: string; finishedAt: string | null; config: string;
  fetched: number; processed: number; inserted: number; updated: number; unchanged: number;
  pages: number; totalSource: number | null; limited: boolean; error: string | null;
};
type Row = Record<string, SQLInputValue>;
type Stored = Omit<Opportunity, "saved" | "note">;

export class Store {
  readonly db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH || "./data/licitai.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.function("it_scope", { deterministic: true }, (description) => typeof description === "string" && hasItTerms(description) ? 1 : 0);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_versions (version INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, raw_json TEXT NOT NULL, record_hash TEXT NOT NULL,
        search_text TEXT NOT NULL, uf TEXT, published_date TEXT, estimated_value REAL, collected_at TEXT NOT NULL, ingestion_kind TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS opportunity_filters ON opportunities(uf, published_date);
      CREATE TABLE IF NOT EXISTS selections (opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id), note TEXT NOT NULL DEFAULT '', saved_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_records (
        import_id TEXT NOT NULL REFERENCES imports(id), opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
        raw_json TEXT NOT NULL, record_hash TEXT NOT NULL, source_url TEXT NOT NULL, collected_at TEXT NOT NULL,
        data_kind TEXT NOT NULL, ingestion_kind TEXT NOT NULL,
        PRIMARY KEY(import_id, opportunity_id)
      );
      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
    if (!this.db.prepare("SELECT version FROM profile_versions LIMIT 1").get()) this.saveProfile(DEMO_PROFILE);
  }
  close() { this.db.close(); }
  private transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = callback(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  getProfile(): Profile {
    const row = this.db.prepare("SELECT * FROM profile_versions ORDER BY version DESC LIMIT 1").get() as Row;
    return { ...JSON.parse(String(row.snapshot_json)), version: Number(row.version), updatedAt: String(row.updated_at) };
  }
  saveProfile(input: ProfileInput): Profile {
    const profile = profileInputSchema.parse(input);
    const updatedAt = new Date().toISOString();
    const result = this.db.prepare("INSERT INTO profile_versions(snapshot_json,updated_at) VALUES (?,?)").run(JSON.stringify(profile), updatedAt);
    return { ...profile, version: Number(result.lastInsertRowid), updatedAt };
  }
  startImport(kind: ImportRun["kind"], config: unknown): ImportRun {
    const run: ImportRun = { id: randomUUID(), kind, status: "running", startedAt: new Date().toISOString(), finishedAt: null, config: JSON.stringify(config), fetched: 0, processed: 0, inserted: 0, updated: 0, unchanged: 0, pages: 0, totalSource: null, limited: false, error: null };
    this.db.prepare("INSERT INTO imports(id,payload_json) VALUES (?,?)").run(run.id, JSON.stringify(run));
    return run;
  }
  getImport(id: string): ImportRun {
    const row = this.db.prepare("SELECT payload_json FROM imports WHERE id=?").get(id);
    if (!row) throw new Error("Importação não encontrada.");
    return JSON.parse(String(row.payload_json));
  }
  updateImport(run: ImportRun): void {
    this.db.prepare("UPDATE imports SET payload_json=? WHERE id=?").run(JSON.stringify(run), run.id);
  }
  ingestPage(runId: string, records: unknown[], context: IngestionContext, metadata: { fetched: number; totalSource: number | null }): void {
    // Toda a página é validada antes da transação: resposta inválida não grava parte da página.
    const normalized = records.map((raw) => normalize(raw, context));
    this.transaction(() => {
      const run = this.getImport(runId);
      if (run.status !== "running") throw new Error("Esta importação já foi encerrada.");
      for (const item of normalized) {
        const existing = this.db.prepare("SELECT payload_json,record_hash FROM opportunities WHERE id=?").get(item.id);
        const prior: Stored | null = existing ? JSON.parse(String(existing.payload_json)) : null;
        const { rawJson, searchText: indexedText, ...payload } = item;
        // Arquivos antigos nunca substituem uma observação mais recente nem rebaixam uma coleta ao vivo.
        const preservePrior = prior && (prior.collectedAt > item.collectedAt || (prior.collectedAt === item.collectedAt && prior.ingestionKind === "live" && item.ingestionKind === "archive"));
        if (!preservePrior) {
          const data = { ...payload, firstCollectedAt: prior?.firstCollectedAt ?? payload.firstCollectedAt };
          this.db.prepare(`INSERT INTO opportunities(id,payload_json,raw_json,record_hash,search_text,uf,published_date,estimated_value,collected_at,ingestion_kind)
            VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            payload_json=excluded.payload_json,raw_json=excluded.raw_json,record_hash=excluded.record_hash,search_text=excluded.search_text,
            uf=excluded.uf,published_date=excluded.published_date,estimated_value=excluded.estimated_value,collected_at=excluded.collected_at,ingestion_kind=excluded.ingestion_kind`)
            .run(item.id, JSON.stringify(data), rawJson, item.recordHash, indexedText, item.uf, item.publishedAt?.slice(0, 10) ?? null, item.estimatedValue, item.collectedAt, item.ingestionKind);
        }
        const snapshot = this.db.prepare("INSERT OR IGNORE INTO import_records(import_id,opportunity_id,raw_json,record_hash,source_url,collected_at,data_kind,ingestion_kind) VALUES (?,?,?,?,?,?,?,?)")
          .run(runId, item.id, rawJson, item.recordHash, item.sourceUrl, item.collectedAt, item.dataKind, item.ingestionKind);
        if (snapshot.changes) {
          run.processed++;
          if (!existing) run.inserted++;
          else if (!preservePrior && String(existing.record_hash) !== item.recordHash) run.updated++;
          else run.unchanged++;
        }
      }
      run.fetched += metadata.fetched;
      run.pages++;
      run.totalSource = metadata.totalSource;
      this.updateImport(run);
    });
  }
  finishImport(id: string, result: { error?: string; limited?: boolean } = {}): ImportRun {
    const run = this.getImport(id);
    run.status = result.error ? (run.processed ? "partial" : "failed") : "success";
    run.error = result.error ?? null;
    run.limited = result.limited ?? false;
    run.finishedAt = new Date().toISOString();
    this.updateImport(run);
    return run;
  }
  recentImports(limit = 10): ImportRun[] {
    return this.db.prepare("SELECT payload_json FROM imports ORDER BY rowid DESC LIMIT ?").all(limit).map((row) => JSON.parse(String(row.payload_json)));
  }
  private opportunity(row: Row): Opportunity {
    return { ...JSON.parse(String(row.payload_json)), saved: row.saved_id !== null && row.saved_id !== undefined, note: row.note == null ? null : String(row.note) };
  }
  getOpportunity(id: string): Opportunity | null {
    const row = this.db.prepare("SELECT o.payload_json,s.opportunity_id AS saved_id,s.note FROM opportunities o LEFT JOIN selections s ON s.opportunity_id=o.id WHERE o.id=?").get(id) as Row | undefined;
    return row ? this.opportunity(row) : null;
  }
  rawRecord(id: string): unknown | null {
    const row = this.db.prepare("SELECT raw_json FROM opportunities WHERE id=?").get(id);
    return row ? JSON.parse(String(row.raw_json)) : null;
  }
  list(input: Partial<Filters> = {}, savedOnly = false, pageSize = 10): { items: Opportunity[]; total: number; pages: number; page: number } {
    const filters = filterSchema.parse(input);
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (savedOnly) where.push("s.opportunity_id IS NOT NULL");
    if (filters.uf) { where.push("o.uf=?"); params.push(filters.uf); }
    if (filters.q) {
      where.push("o.search_text LIKE ? ESCAPE '\\'");
      params.push(`%${searchText(filters.q).replace(/[\\%_]/g, "\\$&")}%`);
    }
    if (filters.sector === "it") {
      where.push("it_scope(json_extract(o.payload_json,'$.description'))=1");
    }
    if (filters.from) { where.push("o.published_date>=?"); params.push(filters.from); }
    if (filters.to) { where.push("o.published_date<=?"); params.push(filters.to); }
    if (filters.min !== "") { where.push("o.estimated_value>=?"); params.push(filters.min); }
    if (filters.max !== "") { where.push("o.estimated_value<=?"); params.push(filters.max); }
    const join = "FROM opportunities o LEFT JOIN selections s ON s.opportunity_id=o.id";
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const total = Number(this.db.prepare(`SELECT COUNT(*) AS count ${join}${clause}`).get(...params)!.count);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(filters.page, pages);
    const rows = this.db.prepare(`SELECT o.payload_json,s.opportunity_id AS saved_id,s.note ${join}${clause} ORDER BY o.published_date DESC,o.id ASC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize) as Row[];
    return { items: rows.map((row) => this.opportunity(row)), total, pages, page };
  }
  setSaved(id: string, saved: boolean): void {
    if (!this.getOpportunity(id)) throw new Error("Oportunidade não encontrada.");
    if (saved) this.db.prepare("INSERT OR IGNORE INTO selections(opportunity_id,note,saved_at) VALUES (?,'',?)").run(id, new Date().toISOString());
    else this.db.prepare("DELETE FROM selections WHERE opportunity_id=?").run(id);
  }
  saveNote(id: string, note: string): void {
    if (note.length > 4000) throw new Error("A anotação deve ter até 4.000 caracteres.");
    if (!this.db.prepare("UPDATE selections SET note=? WHERE opportunity_id=?").run(note, id).changes) throw new Error("Salve a oportunidade antes de anotar.");
  }
  stats() {
    const row = this.db.prepare("SELECT COUNT(*) AS total,MAX(collected_at) AS last_collected FROM opportunities").get()!;
    const selected = Number(this.db.prepare("SELECT COUNT(*) AS count FROM selections").get()!.count);
    const historical = Number(this.db.prepare("SELECT COUNT(*) AS count FROM opportunities WHERE ingestion_kind='archive' OR collected_at<?").get(new Date(Date.now() - 7 * 86400000).toISOString())!.count);
    return { total: Number(row.total), selected, historical, lastCollected: row.last_collected == null ? null : String(row.last_collected) };
  }
}
