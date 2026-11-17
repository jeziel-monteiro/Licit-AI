import { test } from "node:test";
import assert from "node:assert/strict";
import { generateGemini } from "../src/lib/server/gemini";
import { AdherenceError } from "../src/lib/adherence/errors";

const input = { instructions: "Responda em JSON.", data: "teste", schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } };
test("Gemini repete falhas transitórias com limite e retorna metadados seguros", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  let calls = 0;
  try {
    const result = await generateGemini(input, async (_url, request) => {
      calls++;
      assert.equal((request?.headers as Record<string, string>)["x-goog-api-key"], "test-only");
      if (calls < 3) throw new TypeError("network");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 } }), { status: 200 });
    });
    assert.equal(result.metadata.attempts, 3);
    assert.equal(result.metadata.usage?.totalTokens, 5);
    assert.equal(JSON.parse(result.text).answer, "ok");
    assert.equal(JSON.stringify(result).includes("test-only"), false);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("Gemini não repete erro de credencial", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  let calls = 0;
  try {
    await assert.rejects(generateGemini(input, async () => { calls++; return new Response("{}", { status: 401 }); }), (error: unknown) => error instanceof AdherenceError && error.failure.code === "credentials");
    assert.equal(calls, 1);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});
