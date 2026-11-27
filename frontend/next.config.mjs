// Matches the Vercel platform default so the deployed value is not weakened.
const HSTS_POLICY = "max-age=63072000; includeSubDomains; preload";

// The app needs no powerful browser features. Clipboard access stays allowed
// for copying staff activation links.
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

// These directives cannot break Next.js scripts, styles or API calls. A strict
// script/style policy needs per-request nonces and is tracked separately.
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

export function securityHeaders(nodeEnv = process.env.NODE_ENV) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  ];

  if (nodeEnv === "production") {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_POLICY });
  }

  return headers;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allows a clean verification build when OneDrive locks the normal .next output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;
