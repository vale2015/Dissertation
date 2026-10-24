import { ROLES } from "./permissions.js";

export const CHATBOT_SKELETON = Object.freeze({
  phase: "skeleton",
  conversation_enabled: false,
  business_tools_enabled: false,
});

export async function verifyChatbotManager({ token, backendApiUrl, fetchImpl = fetch }) {
  if (!token) {
    return { status: 401, error: "Authentication required." };
  }
  if (!backendApiUrl) {
    return { status: 503, error: "Assistant authentication is unavailable." };
  }

  try {
    const response = await fetchImpl(`${backendApiUrl.replace(/\/$/, "")}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401) {
      return { status: 401, error: "Authentication required." };
    }
    if (!response.ok) {
      return { status: 503, error: "Unable to verify assistant access." };
    }

    const data = await response.json();
    if (data?.user?.role !== ROLES.MANAGER) {
      return { status: 403, error: "The assistant preview is for managers only." };
    }
    return { status: 200, userId: data.user.id };
  } catch {
    return { status: 503, error: "Unable to verify assistant access." };
  }
}
