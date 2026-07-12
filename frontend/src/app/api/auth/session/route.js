import { cookies } from "next/headers";
import { NextResponse } from "next/server";


const SESSION_COOKIE_NAME = "rfs_session";


// Return a response that must never be cached.
function jsonResponse(body, status) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}


// Check the HttpOnly cookie and retrieve the current user from Flask.
export async function GET() {
  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured.");

    return jsonResponse(
      { error: "Authentication service is not configured." },
      500
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return jsonResponse(
      { authenticated: false, error: "Authentication required." },
      401
    );
  }

  try {
    const backendResponse = await fetch(
      `${backendApiUrl}/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await backendResponse.json().catch(() => null);

    if (backendResponse.status === 401) {
      // The token is missing, invalid or expired.
      // Delete the unusable cookie from the browser.
      const response = jsonResponse(
        {
          authenticated: false,
          error: data?.error || "Session has expired.",
        },
        401
      );

      response.cookies.delete(SESSION_COOKIE_NAME);

      return response;
    }

    if (!backendResponse.ok) {
      console.error(
        "Flask session verification failed:",
        backendResponse.status
      );

      return jsonResponse(
        {
          authenticated: false,
          error: "Unable to verify the session.",
        },
        503
      );
    }

    if (!data?.user) {
      console.error(
        "Flask /auth/me response did not contain a user."
      );

      return jsonResponse(
        {
          authenticated: false,
          error: "Invalid authentication response.",
        },
        502
      );
    }

    return jsonResponse(
      {
        authenticated: true,
        user: data.user,
      },
      200
    );
  } catch (error) {
    console.error("Session verification request failed:", error);

    return jsonResponse(
      {
        authenticated: false,
        error: "Authentication service is unavailable.",
      },
      503
    );
  }
}