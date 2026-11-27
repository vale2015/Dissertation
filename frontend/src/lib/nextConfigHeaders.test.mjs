import assert from "node:assert/strict";
import test from "node:test";

import nextConfig, { securityHeaders } from "../../next.config.mjs";

function asMap(headers) {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}

test("security headers apply to every route", async () => {
  const rules = await nextConfig.headers();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
});

test("baseline browser security headers are sent in every environment", () => {
  for (const env of ["development", "test", "production"]) {
    const headers = asMap(securityHeaders(env));
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      assert.match(headers["Permissions-Policy"], new RegExp(`(^|, )${feature}=\\(\\)`));
    }
    assert.doesNotMatch(headers["Permissions-Policy"], /clipboard/);
  }
});

test("CSP uses only directives that cannot block app scripts, styles or API calls", () => {
  const csp = asMap(securityHeaders("production"))["Content-Security-Policy"];
  const directives = csp.split("; ");
  assert.deepEqual(directives.sort(), [
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ]);
  assert.doesNotMatch(csp, /default-src|script-src|style-src|connect-src/);
});

test("HSTS is production-only and at least as strong as the Vercel default", () => {
  assert.equal(asMap(securityHeaders("development"))["Strict-Transport-Security"], undefined);
  assert.equal(asMap(securityHeaders("test"))["Strict-Transport-Security"], undefined);
  assert.equal(
    asMap(securityHeaders("production"))["Strict-Transport-Security"],
    "max-age=63072000; includeSubDomains; preload",
  );
});
