import assert from "node:assert/strict";
import test from "node:test";
import { classifyWithCloudflare, cloudflareModelAvailable, taskSignals, modelFailureCategory, modelFailureDiagnostics } from "./chatbot-model.mjs";

test("model is unavailable without both server settings", async () => {
  assert.equal(cloudflareModelAvailable({ CLOUDFLARE_ACCOUNT_ID: "x" }), false);
  assert.equal(await classifyWithCloudflare("hello", { env: {} }), "unknown");
  assert.equal(cloudflareModelAvailable({ CLOUDFLARE_ACCOUNT_ID: " \n\t", CLOUDFLARE_API_TOKEN: "synthetic-token" }), false);
  assert.equal(cloudflareModelAvailable({ CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: " \n\t" }), false);
});

test("provider construction trims surrounding whitespace but preserves quotes", async () => {
  const account = "a".repeat(32);
  for (const token of ["synthetic-token", '"synthetic-quoted-token"']) {
    const env = { CLOUDFLARE_ACCOUNT_ID: ` \n${account}\t `, CLOUDFLARE_API_TOKEN: ` \n${token}\t ` };
    assert.equal(cloudflareModelAvailable(env), true);
    const intent = await classifyWithCloudflare("nearby happenings", { env, generate: async ({ model }) => {
      // The installed provider exposes config as confirmed in its source.
      assert.equal(new Headers(model.config.headers()).get("authorization"), `Bearer ${token}`);
      assert.equal(model.config.url({ path: "/chat/completions" }), `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`);
      return { text: "events" };
    } });
    assert.equal(intent, "events");
    assert.equal(env.CLOUDFLARE_API_TOKEN, ` \n${token}\t `);
  }
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

test("failure diagnostics retain only bounded status/codes and configuration shape booleans", () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: ` \n${"a".repeat(32)} `, CLOUDFLARE_API_TOKEN: ' \n"synthetic-private-token"\t' };
  const diagnostics = modelFailureDiagnostics({
    statusCode: 403,
    message: "sensitive-message",
    url: "https://sensitive-url.invalid",
    responseHeaders: { Authorization: "sensitive-header" },
    requestBodyValues: { input: "sensitive-input" },
    responseBody: JSON.stringify({ errors: [{ code: 10000, message: "sensitive-provider-message" }, { code: "9106 sensitive-code" }, { code: -1 }, { code: 1.5 }, { code: 1000000 }, { code: { secret: "sensitive-object" } }], error: { code: 9106, message: "sensitive-nested-message" }, token: "sensitive-body-token" }),
  }, env);
  assert.deepEqual(diagnostics, {
    category: "provider_auth", http_status: 403, cloudflare_error_codes: [10000, 9106],
    configuration: { account_id_expected_shape: true, account_id_outer_whitespace: true, token_outer_whitespace: true, account_id_outer_quotes: false, token_outer_quotes: true },
  });
  assert.doesNotMatch(JSON.stringify(diagnostics), /sensitive-|synthetic-private-token|a{32}/);
});

test("diagnostics bound error-body parsing, numeric count and invalid HTTP statuses", () => {
  for (const body of ["not json with sensitive-token", "x".repeat(16385), JSON.stringify({ error: { code: "403" } })]) {
    const diagnostic = modelFailureDiagnostics({ statusCode: 999, responseBody: body }, {});
    assert.equal(Object.hasOwn(diagnostic, "http_status"), false);
    assert.deepEqual(diagnostic.cloudflare_error_codes, []);
  }
  const bounded = modelFailureDiagnostics({ statusCode: 403.5, responseBody: JSON.stringify({ errors: [1, 2, 2, 3, 4, 5, 6, 7].map((code) => ({ code })) }) }, {});
  assert.equal(Object.hasOwn(bounded, "http_status"), false);
  assert.deepEqual(bounded.cloudflare_error_codes, [1, 2, 3, 4, 5]);
  const quoted = modelFailureDiagnostics({}, { CLOUDFLARE_ACCOUNT_ID: '"' + "a".repeat(32) + '"', CLOUDFLARE_API_TOKEN: "synthetic-token" });
  assert.equal(quoted.configuration.account_id_expected_shape, false);
  assert.equal(quoted.configuration.account_id_outer_quotes, true);
});

test("only allowlisted labels can become chatbot intents", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_API_TOKEN: "test" };
  const label = await classifyWithCloudflare("nearby happenings", { env, generate: async () => ({ text: "events" }) });
  const invented = await classifyWithCloudflare("delete everything", { env, generate: async () => ({ text: "delete_database" }) });
  assert.equal(label, "events");
  assert.equal(invented, "unknown");
});
