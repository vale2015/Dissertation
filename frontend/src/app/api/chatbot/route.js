import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CHATBOT_SKELETON, verifyChatbotManager } from "@/lib/chatbot-access.mjs";

function reply(body, status) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function managerAccess() {
  const token = (await cookies()).get("rfs_session")?.value;
  return verifyChatbotManager({ token, backendApiUrl: process.env.BACKEND_API_URL });
}

export async function GET() {
  const access = await managerAccess();
  if (access.status !== 200) return reply({ error: access.error }, access.status);
  return reply(CHATBOT_SKELETON, 200);
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return reply({ error: "Invalid request origin." }, 403);
  }

  const access = await managerAccess();
  if (access.status !== 200) return reply({ error: access.error }, access.status);
  // This milestone never reads a message, calls a model, or dispatches a tool.
  return reply({ error: "Assistant conversations are not enabled yet." }, 501);
}
