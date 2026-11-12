"use server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/server/store";
import { pncpIdSchema, profileInputSchema } from "@/lib/domain";
import { publicationQuerySchema } from "@/lib/pncp/client";
import { importArchive, importPublications } from "@/lib/pncp/importer";

export type ActionResult = { success: boolean; message: string };
function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { success: false, message: error.issues.map((issue) => issue.message).join(" ") };
  console.error("Falha em uma ação local:", error);
  return { success: false, message: "Não foi possível salvar a alteração. Tente novamente." };
}
function refresh() { revalidatePath("/", "layout"); }
export async function setSavedAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const id = pncpIdSchema.parse(form.get("id"));
    const saved = z.enum(["true", "false"]).parse(form.get("saved")) === "true";
    getStore().setSaved(id, saved);
    refresh();
    return { success: true, message: saved ? "Oportunidade salva na seleção." : "Oportunidade removida da seleção." };
  } catch (error) { return failure(error); }
}
export async function saveProfileAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const split = (key: string) => String(form.get(key) ?? "").split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    const profile = profileInputSchema.parse({ name: form.get("name"), description: form.get("description"), interestTerms: split("interestTerms"), exclusionTerms: split("exclusionTerms"), uf: form.get("uf") });
    getStore().saveProfile(profile);
    refresh();
    return { success: true, message: "Perfil da empresa salvo com sucesso." };
  } catch (error) { return failure(error); }
}
export async function saveNoteAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const id = pncpIdSchema.parse(form.get("id"));
    const note = z.string().max(4000, "A anotação deve ter até 4.000 caracteres.").parse(form.get("note"));
    getStore().saveNote(id, note);
    refresh();
    return { success: true, message: "Anotação salva." };
  } catch (error) { return failure(error); }
}
export async function runImportAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const query = publicationQuerySchema.parse({ from: form.get("from"), to: form.get("to"), uf: form.get("uf"), modality: form.get("modality"), pageSize: 50, maxPages: 2, maxRecords: 100 });
    const run = await importPublications(getStore(), query);
    refresh();
    return { success: run.status === "success", message: run.error ?? `Coleta concluída: ${run.processed} registros processados, ${run.inserted} novos, ${run.updated} atualizados e ${run.unchanged} sem alteração.${run.limited ? " O limite desta coleta foi atingido; a base é parcial." : ""}` };
  } catch (error) { return failure(error); }
}
export async function loadSampleAction(_previous: ActionResult, _form: FormData): Promise<ActionResult> {
  void _form;
  try {
    const file = resolve(process.cwd(), "data/pncp-sample.json");
    const run = importArchive(getStore(), JSON.parse(await readFile(file, "utf8")), "data/pncp-sample.json");
    refresh();
    return { success: run.status === "success", message: run.error ?? `Amostra histórica carregada: ${run.processed} registros processados. Coletas mais recentes foram preservadas.` };
  } catch (error) { return failure(error); }
}
