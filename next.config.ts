import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The Docker image runs the self-contained server this produces (P1-001).
  output: "standalone",

  // Local development only: /v1/* goes to the API on another port, so the
  // client calls relative paths and dev needs no CORS. In production Caddy
  // passes admin.{domain}/v1/* to the API before it reaches Next.js, so the
  // admin and its API share an origin (04-api-spec.md §1, P1-001).
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://localhost:8080"}/v1/:path*`,
      },
    ]
  },

  // The vendored TailAdmin icons (src/icons) are SVG files imported as React
  // components. The turbopack rule keeps a future `next dev --turbopack` from
  // silently importing them as URLs instead.
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    })
    return config
  },
  experimental: {
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },
}

export default nextConfig
