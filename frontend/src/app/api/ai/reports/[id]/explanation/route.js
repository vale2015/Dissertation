import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateReportExplanation } from "@/lib/report-ai.mjs";

function reply(body, status) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request, context) {
  const { id } = await context.params;
  if (!/^[1-9]\d{0,9}$/.test(id || "")) {
    return reply({ error: "Invalid report ID." }, 400);
  }
  if (!(await cookies()).get("rfs_session")?.value) {
    return reply({ error: "Authentication required." }, 401);
  }
  return reply({ available: process.env.AI_REPORT_EXPLANATIONS_ENABLED === "true"
    && Boolean(process.env.BACKEND_API_URL && process.env.AI_GATEWAY_MODEL) }, 200);
}

export async function POST(request, context) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return reply({ error: "Invalid request origin." }, 403);
  }

  const { id } = await context.params;
  if (!/^[1-9]\d{0,9}$/.test(id || "")) {
    return reply({ error: "Invalid report ID." }, 400);
  }

  const token = (await cookies()).get("rfs_session")?.value;
  if (!token) {
    return reply({ error: "Authentication required." }, 401);
  }

  if (process.env.AI_REPORT_EXPLANATIONS_ENABLED !== "true") {
    return reply({ error: "AI explanations are not available yet." }, 503);
  }

  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");
  const model = process.env.AI_GATEWAY_MODEL;
  if (!backendApiUrl || !model) {
    console.error("AI report explanation configuration is incomplete.");
    return reply({ error: "AI explanations are temporarily unavailable." }, 503);
  }

  let report;
  try {
    const response = await fetch(`${backendApiUrl}/reports/history/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401 || response.status === 403) {
      return reply({ error: "You do not have access to this report." }, response.status);
    }
    if (response.status === 404) {
      return reply({ error: "Saved report not found." }, 404);
    }
    if (!response.ok) {
      return reply({ error: "Unable to load the saved report." }, 503);
    }
    report = await response.json();
  } catch {
    return reply({ error: "Unable to load the saved report." }, 503);
  }

  try {
    const observations = await generateReportExplanation(report, model);
    return reply({
      report_id: Number(id),
      observations,
      generated_at: new Date().toISOString(),
      note: "AI draft for manager review. Source values come from the saved report.",
    }, 200);
  } catch (error) {
    console.error("AI report explanation failed:", error?.name || "UnknownError");
    return reply({ error: "The AI explanation is unavailable. The saved report is unchanged." }, 503);
  }
}
