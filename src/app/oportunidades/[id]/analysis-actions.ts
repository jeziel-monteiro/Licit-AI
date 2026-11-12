"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { parseRouteId } from "@/lib/domain";
import { createAdherenceService } from "@/lib/server/adherence";
import { AdherenceError, safeFailure } from "@/lib/adherence/errors";
import type { SafeFailure } from "@/lib/adherence/contracts";

export type AnalysisActionState = { failure: SafeFailure | null };
export async function runAdherenceAction(_previous: AnalysisActionState, form: FormData): Promise<AnalysisActionState> {
  try {
    const id = parseRouteId(form.get("id"));
    if (!id) throw new AdherenceError("not_found");
    const operation = z.enum(["analyze", "validate"]).parse(form.get("operation"));
    const service = createAdherenceService();
    if (operation === "validate") {
      const analysisId = z.uuid().parse(form.get("analysisId"));
      await service.revalidate(id, analysisId);
    } else await service.analyze(id);
    revalidatePath("/", "layout");
    return { failure: null };
  } catch (error) {
    return { failure: error instanceof z.ZodError ? { code: "not_found", retryable: false } : safeFailure(error) };
  }
}
