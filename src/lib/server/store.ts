import "server-only";
import { Store } from "../db";

const globalStore = globalThis as unknown as { licitaiStore?: Store };
export function getStore(): Store {
  return globalStore.licitaiStore ??= new Store();
}
