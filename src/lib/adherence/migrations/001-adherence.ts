// Migração aditiva e com namespace próprio para não disputar versões numéricas com os colegas.
export const ADHERENCE_MIGRATION_NAME = "adherence-001";
export const ADHERENCE_MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS adherence_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS adherence_analyses (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
    input_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('processing','pending_validation','validated','rejected','failed')),
    payload_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS adherence_input_lookup ON adherence_analyses(opportunity_id,input_hash,status);
  CREATE TABLE IF NOT EXISTS adherence_locks (
    opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id),
    analysis_id TEXT NOT NULL REFERENCES adherence_analyses(id),
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL
  );
`;
