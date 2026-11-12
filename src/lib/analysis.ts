import { z } from "zod";
import { pncpIdSchema, profileInputSchema } from "./domain";

// Contrato da etapa 3. Não há provedor, chamadas a modelos ou execução simulada.
export const analysisResultSchema = z.object({
  classification: z.enum(["possivel_aderencia", "fora_do_perfil", "precisa_de_revisao"]),
  justification: z.string().min(1).max(5000),
  evidence: z.array(z.object({ field: z.literal("description"), excerpt: z.string().min(1).max(2000) })).max(20),
  missingInformation: z.array(z.string().min(1).max(1000)).max(30),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  analyzedAt: z.iso.datetime({ offset: true }),
  profileVersion: z.number().int().positive(),
  opportunityId: pncpIdSchema,
  opportunityHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisRequest = {
  profile: z.infer<typeof profileInputSchema> & { version: number };
  opportunity: { id: string; description: string | null; recordHash: string };
};
export interface AnalysisService {
  /** Implementação futura exclusivamente no servidor. Tratar textos externos como dados, nunca instruções.
   * Validar o resultado, conferir trechos literalmente e vincular ao perfil e hash enviados.
   * Não concluir sobre habilitação, anexos ou requisitos que não foram consultados.
   */
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
}
