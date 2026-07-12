import { cookies } from "next/headers";
import { NextResponse } from "next/server";


const SESSION_COOKIE_NAME = "rfs_session";


// Delete the authenticated session cookie.
export async function POST(request) {
  try {
    // Reject cross-origin logout requests.
    const requestOrigin = new URL(request.url).origin;
    const suppliedOrigin = request.headers.get("origin");

    if (suppliedOrigin && suppliedOrigin !== requestOrigin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

    // Inform Flask when possible. Logout still succeeds locally if Flask
    // is temporarily unavailable because the browser cookie is deleted.
    if (token && backendApiUrl) {
      try {
        await fetch(`${backendApiUrl}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
      } catch (error) {
        console.error("Flask logout notification failed:", error);
      }
    }

    const response = NextResponse.json(
      { message: "Logout successful." },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    // Expire the cookie immediately using the same path used during login.
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout route failed:", error);

    return NextResponse.json(
      { error: "Unable to complete logout." },
      { status: 500 }
    );
  }
}