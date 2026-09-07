# new-commerce-web

The admin front end for New Commerce — catalog management for Indonesian
merchants. Next.js 15 App Router, TypeScript, Tailwind 3.

The API lives in [`new-commerce-api`](https://github.com/miqbalhamdani/new-commerce-api).
The contract both repos are built against is
[`new-commerce-contracts`](https://github.com/miqbalhamdani/new-commerce-contracts),
vendored here as a submodule at `contracts/`.

## Getting started

You need the API running first — the app has no data of its own.

```bash
git submodule update --init      # a fresh clone needs this once
npm install
npm run dev                      # http://localhost:3000
```

In another terminal, from `new-commerce-api`:

```bash
make db-create && make migrate
make dev                         # http://localhost:8080
```

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run generate` | Regenerate API types from `contracts/openapi.yaml` |
| `npm run test` | Vitest |
| `npm run check` | The bar for a pull request: generate, staleness check, lint, typecheck, test |

## One origin

The browser only ever talks to `localhost:3000`. `next.config.ts` forwards
`/v1/*` to the API, which is what Caddy does in production — so the refresh
token can be an ordinary `SameSite=Lax` cookie with no CORS anywhere in the
system.

Call the API with relative paths. Never `http://localhost:8080`.

## Generated code

`src/lib/api/schema.d.ts` is generated from the contract and must not be
edited — `npm run check` fails if it is stale. To add an endpoint, change
`openapi.yaml` in the contracts repo first, tag it, bump the submodule here,
then regenerate.

## Third-party components

`src/components/` is the [Tremor](https://tremor.so) component set, vendored
rather than installed. Prefer configuring those files over editing them: edits
are lost the next time a component is re-pulled from upstream. The ones under
`src/components/ui/navigation/` are ours and are fine to change.

Their license is in `LICENSE.md` and applies to that vendored code. It stays as
long as the components do.

`CLAUDE.md` carries the rules that matter — tenancy, money, error handling,
what not to do.
