import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Local development only: /v1/* goes to the API on another port, so the
  // client calls relative paths and dev needs no CORS. In production the admin
  // and the API are separate hosts (admin.{domain}, api.{domain}, 04-api-spec.md
  // §1); that setup lands with P1-001.
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
