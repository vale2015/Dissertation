import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyChatbotManager } from "@/lib/chatbot-access.mjs";
import { classifyChatbotMessage, chatbotReadTarget, summarizeChatbotResult, validChatbotContext } from "@/lib/chatbot-read.mjs";
import { classifyWithCloudflare, cloudflareModelAvailable } from "@/lib/chatbot-model.mjs";

function reply(body, status) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function managerAccess() {
  const token = (await cookies()).get("rfs_session")?.value;
  const access = await verifyChatbotManager({ token, backendApiUrl: process.env.BACKEND_API_URL });
  return { ...access, token };
}

async function backendRequest(token, target) {
  const response = await fetch(`${process.env.BACKEND_API_URL.replace(/\/$/, "")}${target.path}`, {
    method: target.method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(target.body ? { "Content-Type": "application/json" } : {}) },
    body: target.body ? JSON.stringify(target.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(target.method === "POST" ? 25000 : 15000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { error: body?.error?.message || body?.message || "That request is unavailable right now.", status: response.status };
  }
  return { body };
}

export async function GET() {
  const access = await managerAccess();
  if (access.status !== 200) return reply({ error: access.error }, access.status);
  try {
    const weather = await backendRequest(access.token, { path: "/weather/", method: "GET" });
    return reply({
      conversation_enabled: true,
      model_enabled: cloudflareModelAvailable(),
      weather: weather.body ? summarizeChatbotResult({ intent: "weather" }, weather.body) : null,
      weather_error: weather.error || (weather.body ? null : "Weather is unavailable right now."),
    }, 200);
  } catch {
    return reply({ conversation_enabled: true, model_enabled: cloudflareModelAvailable(), weather: null, weather_error: "Weather is unavailable right now." }, 200);
  }
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return reply({ error: "Invalid request origin." }, 403);
  }

  const access = await managerAccess();
  if (access.status !== 200) return reply({ error: access.error }, access.status);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("application/json")) return reply({ error: "Send a JSON message." }, 415);
  const bodySize = Number(request.headers.get("content-length") || 0);
  if (bodySize > 2048) return reply({ error: "Message is too long." }, 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string" || JSON.stringify(body).length > 2048 || Object.keys(body).some((key) => !["message", "context"].includes(key))) {
    return reply({ error: "A message is required." }, 400);
  }
  const context = body.context == null ? null : validChatbotContext(body.context);
  if (body.context != null && !context) return reply({ error: "Invalid conversation context." }, 400);

  let intent = classifyChatbotMessage(body.message, context);
  if (intent.error) return reply({ error: intent.error }, 400);
  if (intent.intent === "unknown" && cloudflareModelAvailable()) {
    // Do not send likely account identifiers or secrets to the model.
    if (/@|\b(password|token|secret|reset link)\b/i.test(body.message)) {
      return reply({ text: "Please use the staff workspace for account details. Ask me to manage staff." }, 200);
    }
    try {
      intent = { intent: await classifyWithCloudflare(body.message) };
    } catch {
      return reply({ text: "AI interpretation is temporarily unavailable. Try asking directly for weather, events, reports, or staff management." }, 200);
    }
  }

  let target = chatbotReadTarget(intent);
  if (target.resolve === "latest_report") {
    try {
      const latest = await backendRequest(access.token, { path: "/dashboard/", method: "GET" });
      const selectedDate = latest.body?.latest_record?.date;
      if (latest.error || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate || "")) {
        return reply({ text: "Which report date should I use? Please enter it as YYYY-MM-DD." }, 200);
      }
      intent = { ...intent, date: selectedDate };
      target = chatbotReadTarget(intent);
    } catch {
      return reply({ text: "I could not find the latest available report date. Please enter a date as YYYY-MM-DD." }, 200);
    }
  }
  if (target.error) return reply({ error: target.error }, 400);
  if (target.prompt) return reply({ text: target.prompt }, 200);
  if (target.workspace) return reply({ text: target.search ? `I searched staff accounts for “${target.search}” in the secure workspace below.` : "I can manage staff here. Use the secure workspace below to review accounts or make a change; each change stays within the chat and uses the app's permission checks.", workspace: "staff", search: target.search }, 200);
  if (target.download) return reply({ text: "Preparing your report download here in the chat.", download: target }, 200);

  try {
    const result = await backendRequest(access.token, target);
    if (result.error) return reply({ error: result.error }, result.status);
    return reply(summarizeChatbotResult(intent, result.body), 200);
  } catch {
    return reply({ error: "The restaurant service is unavailable right now. Please try again." }, 503);
  }
}
