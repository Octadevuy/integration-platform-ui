import type { NextConfig } from "next";

// This app has no third-party scripts, external fonts, or external images:
// next/font self-hosts Manrope/IBM Plex Mono at build time (see
// src/app/layout.tsx) and every fetch call goes through same-origin BFF
// proxies (src/app/api/**). That's why the policy below can stay locked to
// 'self' instead of allow-listing external hosts.
//
// 'unsafe-inline' is kept for script-src/style-src (instead of a nonce)
// because: (1) Next.js App Router injects inline bootstrap/flight-data
// <script> tags on every response, and (2) Radix/base-ui components set
// inline `style` attributes for positioning popovers/tooltips. A nonce-based
// CSP would require migrating middleware.ts to the new proxy.ts convention
// and forcing dynamic rendering on every route - out of scope for this fix.
// This still blocks framing, plugins/objects, and restricts base-uri/
// form-action/connect-src to same-origin, which is the bulk of the value.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const nextConfig: NextConfig = {
  logging: {
    serverFunctions: false,
  },
  async headers() {
    return [
      {
        // Applies to every route, including /api/**; harmless for JSON
        // responses and required for the HTML-serving routes.
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            // Superseded by CSP's frame-ancestors above for modern browsers,
            // kept for defense-in-depth on older ones.
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "same-origin",
          },
          // Strict-Transport-Security intentionally omitted: docker-compose.yml
          // ships this app listening on plain HTTP (NEXTAUTH_URL=http://...)
          // with no TLS-terminating reverse proxy in this repo, so we cannot
          // assert it is always served over HTTPS. Add HSTS at whichever layer
          // terminates TLS in the real deployment (e.g. Azure App Service, or
          // here) once that is confirmed for every environment that runs this
          // image.
        ],
      },
    ]
  },
};

export default nextConfig;
