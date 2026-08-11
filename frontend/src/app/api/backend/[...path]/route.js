import { cookies } from "next/headers";
import { NextResponse } from "next/server";


const SESSION_COOKIE_NAME = "rfs_session";
const MUTATING_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);


function errorResponse(message, status) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}


// Forward an authenticated request from Next.js to Flask.
async function proxyRequest(request, context) {
  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured.");

    return errorResponse(
      "Backend service is not configured.",
      500
    );
  }

  const method = request.method.toUpperCase();

  // Protect state-changing requests against cross-origin submissions.
  if (MUTATING_METHODS.has(method)) {
    const requestOrigin = new URL(request.url).origin;
    const suppliedOrigin = request.headers.get("origin");

    if (suppliedOrigin && suppliedOrigin !== requestOrigin) {
      return errorResponse("Invalid request origin.", 403);
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return errorResponse("Authentication required.", 401);
  }

  const { path } = await context.params;

  if (!Array.isArray(path) || path.length === 0) {
    return errorResponse("Backend route is required.", 400);
  }

  // Encode every segment so it cannot modify the intended backend URL.
  const safePath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(`${backendApiUrl}/${safePath}`);

  backendUrl.search = incomingUrl.search;

  const headers = new Headers();

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", request.headers.get("accept") || "application/json");

  const contentType = request.headers.get("content-type");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  let requestBody;

  if (method !== "GET" && method !== "HEAD") {
    const bodyBuffer = await request.arrayBuffer();

    if (bodyBuffer.byteLength > 0) {
      requestBody = bodyBuffer;
    }
  }

  try {
    const backendResponse = await fetch(backendUrl, {
      method,
      headers,
      body: requestBody,
      cache: "no-store",
      // Flask routes may canonicalize a path by adding a trailing slash.
      // Follow that redirect so callers always receive the API response,
      // rather than an unusable redirect without a proxied Location header.
      redirect: "follow",
    });

    const responseHeaders = new Headers();

    const responseContentType =
      backendResponse.headers.get("content-type");

    if (responseContentType) {
      responseHeaders.set("Content-Type", responseContentType);
    }

    const contentDisposition = backendResponse.headers.get(
      "content-disposition"
    );
    if (contentDisposition) {
      responseHeaders.set("Content-Disposition", contentDisposition);
    }

    responseHeaders.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    const response = new NextResponse(
      backendResponse.body,
      {
        status: backendResponse.status,
        headers: responseHeaders,
      }
    );

    // Remove invalid or expired sessions.
    if (backendResponse.status === 401) {
      response.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    console.error("Backend proxy request failed:", error);

    return errorResponse(
      "Unable to connect to the backend service.",
      503
    );
  }
}


export async function GET(request, context) {
  return proxyRequest(request, context);
}


export async function POST(request, context) {
  return proxyRequest(request, context);
}


export async function PUT(request, context) {
  return proxyRequest(request, context);
}


export async function PATCH(request, context) {
  return proxyRequest(request, context);
}


export async function DELETE(request, context) {
  return proxyRequest(request, context);
}
