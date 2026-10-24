import assert from "node:assert/strict";
import test from "node:test";

import { CHATBOT_SKELETON, verifyChatbotManager } from "./chatbot-access.mjs";

test("the skeleton never enables conversation or business tools", () => {
  assert.equal(CHATBOT_SKELETON.conversation_enabled, false);
  assert.equal(CHATBOT_SKELETON.business_tools_enabled, false);
});

test("chatbot access requires a cookie token", async () => {
  const result = await verifyChatbotManager({ token: "", backendApiUrl: "https://backend.example" });
  assert.equal(result.status, 401);
});

test("chatbot access uses the backend identity and only allows managers", async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url, authorization: options.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ user: { id: 3, role: "supervisor" } }) };
  };
  const result = await verifyChatbotManager({ token: "test-token", backendApiUrl: "https://backend.example/", fetchImpl });
  assert.equal(result.status, 403);
  assert.deepEqual(seen, [{ url: "https://backend.example/auth/me", authorization: "Bearer test-token" }]);
});

test("a verified manager can read only the skeleton status", async () => {
  const result = await verifyChatbotManager({
    token: "test-token",
    backendApiUrl: "https://backend.example",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ user: { id: 7, role: "manager" } }) }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.userId, 7);
  assert.equal(CHATBOT_SKELETON.business_tools_enabled, false);
});

test("expired tokens and backend failure fail closed", async () => {
  const expired = await verifyChatbotManager({
    token: "expired",
    backendApiUrl: "https://backend.example",
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  const unavailable = await verifyChatbotManager({
    token: "test-token",
    backendApiUrl: "https://backend.example",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(expired.status, 401);
  assert.equal(unavailable.status, 503);
});
