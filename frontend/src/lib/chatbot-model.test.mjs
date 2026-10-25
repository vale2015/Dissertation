import assert from "node:assert/strict";
import test from "node:test";
import { classifyWithCloudflare, cloudflareModelAvailable } from "./chatbot-model.mjs";

test("model is unavailable without both server settings", async () => {
  assert.equal(cloudflareModelAvailable({ CLOUDFLARE_ACCOUNT_ID: "x" }), false);
  assert.equal(await classifyWithCloudflare("hello", { env: {} }), "unknown");
});

test("only allowlisted labels can become chatbot intents", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_API_TOKEN: "test" };
  const label = await classifyWithCloudflare("nearby happenings", { env, generate: async () => ({ text: "events" }) });
  const invented = await classifyWithCloudflare("delete everything", { env, generate: async () => ({ text: "delete_database" }) });
  assert.equal(label, "events");
  assert.equal(invented, "unknown");
});
