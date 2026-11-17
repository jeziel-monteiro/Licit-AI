import { randomUUID } from "node:crypto";
import type { Store } from "../db";
import type { ExecutionEvent, ProviderMetadata, SafeFailure } from "../adherence/contracts";

export class ExecutionLog {
  constructor(private readonly store: Store) {
    store.db.exec("CREATE TABLE IF NOT EXISTS ai_executions(id TEXT PRIMARY KEY,operation TEXT NOT NULL,created_at TEXT NOT NULL,payload_json TEXT NOT NULL)");
  }
  async record(event: ExecutionEvent): Promise<void> { this.write(event.eventId, "adherence", event); }
  summary(input: { status: "success" | "failed"; startedAt: string; metadata: ProviderMetadata | null; failure: SafeFailure | null; inputHash: string }): void {
    this.write(randomUUID(), "selection_summary", { ...input, finishedAt: new Date().toISOString(), durationMs: Date.now() - Date.parse(input.startedAt) });
  }
  private write(id: string, operation: string, payload: unknown): void {
    this.store.db.prepare("INSERT OR IGNORE INTO ai_executions(id,operation,created_at,payload_json) VALUES (?,?,?,?)").run(id, operation, new Date().toISOString(), JSON.stringify(payload));
  }
}
