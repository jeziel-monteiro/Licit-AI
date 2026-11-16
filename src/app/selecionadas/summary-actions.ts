"use server";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/server/store";
import { createAdherenceService } from "@/lib/server/adherence";
import { SelectionSummaryService } from "@/lib/summary";

export type SummaryActionState = { message: string };
export async function generateSummaryAction(): Promise<SummaryActionState> {
  try {
    await new SelectionSummaryService(getStore(), createAdherenceService()).generateSummary();
    revalidatePath("/selecionadas");
    return { message: "Resumo salvo." };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Salve ao menos") || error.message.startsWith("O resumo aceita") || error.message.startsWith("Configure GEMINI") || error.message.startsWith("O resumo omitiu") || error.message.startsWith("O texto gerado"))) return { message: error.message };
    return { message: "Não foi possível gerar o resumo. Confira a chave, os limites da API e tente novamente." };
  }
}
