import assert from "node:assert/strict";
import test from "node:test";
import { classifyWithCloudflare, cloudflareModelAvailable, taskSignals, modelFailureCategory } from "./chatbot-model.mjs";

test("model is unavailable without both server settings", async () => {
  assert.equal(cloudflareModelAvailable({ CLOUDFLARE_ACCOUNT_ID: "x" }), false);
  assert.equal(await classifyWithCloudflare("hello", { env: {} }), "unknown");
});

test("provider receives fixed task signals only and has bounded reasoning, retries and output", async () => {
  let captured;
  await classifyWithCloudflare("nearby happenings for Alice alex@example.test password=very-secret +447700900001", { env: { CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_API_TOKEN: "test" }, generate: async (options) => { captured = options; return { text: "events" }; } });
  assert.equal(captured.prompt, "Local task signals: events");
  assert.equal(captured.maxRetries, 0);
  assert.equal(captured.maxOutputTokens, 256);
  assert.equal(captured.providerOptions["cloudflare-workers-ai"].reasoningEffort, "low");
  assert.ok(captured.abortSignal);
  assert.equal(taskSignals("Alice alex@example.test +447700900001 yes secret"), "");
  assert.equal(await classifyWithCloudflare("Alice alex@example.test", { env: { CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_API_TOKEN: "test" }, generate: () => { throw new Error("Must never be called"); } }), "unknown");
});

test("diagnostics expose only safe enumerated categories", () => {
  assert.equal(modelFailureCategory({ statusCode: 403, message: "sensitive" }), "provider_auth");
  assert.equal(modelFailureCategory({ statusCode: 429 }), "provider_rate_limit");
  assert.equal(modelFailureCategory({ name: "TimeoutError" }), "provider_timeout");
  assert.equal(modelFailureCategory({ message: "secret" }), "provider_unavailable");
});

test("only allowlisted labels can become chatbot intents", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_API_TOKEN: "test" };
  const label = await classifyWithCloudflare("nearby happenings", { env, generate: async () => ({ text: "events" }) });
  const invented = await classifyWithCloudflare("delete everything", { env, generate: async () => ({ text: "delete_database" }) });
  assert.equal(label, "events");
  assert.equal(invented, "unknown");
});
