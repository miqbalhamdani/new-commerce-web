import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The browser must only ever see one origin. In production Caddy serves this
  // app at / and proxies /v1/* to the API on the same domain (tdd.md 2.2); this
  // rewrite reproduces that locally, where the API is on a different port.
  //
  // It is what lets the refresh token be an ordinary SameSite=Lax cookie with
  // no CORS anywhere in the system. The alternative -- calling :8080 directly
  // and teaching the API which browser origins to trust -- is an API that can
  // be wrong about them.
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://localhost:8080"}/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
