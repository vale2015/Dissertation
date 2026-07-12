import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_DURATION_SECONDS = 60 * 60 * 8;

// Receive login credentials, authenticate through Flask and store the JWT
// in a secure server-managed cookie.
export async function POST(request) {
  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured.");

    return NextResponse.json(
      { error: "Authentication service is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(
      `${backendApiUrl}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
        cache: "no-store",
      }
    );

    const data = await backendResponse.json().catch(() => null);

    if (!backendResponse.ok) {
      const safeMessage =
        backendResponse.status === 400 ||
        backendResponse.status === 401
          ? data?.error || "Invalid email or password."
          : "Authentication service is temporarily unavailable.";

      return NextResponse.json(
        { error: safeMessage },
        { status: backendResponse.status }
      );
    }

    if (!data?.token || !data?.user) {
      console.error("Flask login response did not contain a token or user.");

      return NextResponse.json(
        { error: "Invalid response from the authentication service." },
        { status: 502 }
      );
    }

    const cookieStore = await cookies();

    cookieStore.set("rfs_session", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    // Return user details, but never return the JWT to browser JavaScript.
    return NextResponse.json(
      {
        message: "Login successful",
        user: data.user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Secure login route failed:", error);

    return NextResponse.json(
      { error: "Unable to connect to the authentication service." },
      { status: 503 }
    );
  }
}