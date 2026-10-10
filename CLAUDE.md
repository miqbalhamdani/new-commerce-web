# frontend — Next.js admin

Phase 0 · Foundation (Phase 1 · Catalog next). Next.js 15 App Router · TypeScript · Tailwind 3.

**The contract lives in `contracts/`** (git submodule, pinned to a tag):

| File | What it holds |
|---|---|
| `01-product-requirements.md` | Screens (§4), module stories and acceptance (§6), journeys (§7), targets (§8) |
| `02-business-rules.md` | Every `BR-xxx` rule cited in code, tests and the backlog |
| `04-api-spec.md` | Routes, payloads, errors, the permission matrix (§3) |
| `05-backlog.md` | Items per phase, Acceptance, Rules, Definition of Done |
| `openapi.yaml` | The admin API; `src/lib/api/schema.d.ts` is generated from it |

Before building a screen, read its module in `01-product-requirements.md` §6 and its backlog item.
The item's Acceptance and the Definition of Done are what "done" means, not suggestions.

**Types are generated, calls go through `apiFetch`.** `npm run generate` turns
`contracts/openapi.yaml` into `src/lib/api/schema.d.ts` (never edit it); `src/lib/api/client.ts`
(`apiFetch`) is the one way to call the API, typed from those schemas. `openapi.yaml` gains a path
only when its backend item is done, so an FE item whose path is missing is blocked on that item:
say so, do not hand-type the shape.

---

## Commands

```bash
npm run dev        # localhost:3000; /v1/* rewritten to API_ORIGIN (default :8080)
npm run generate   # openapi-typescript → src/lib/api/schema.d.ts. No-op on a clean tree
npm run lint
npm run typecheck
npm run test       # vitest + testing-library
npm run check      # generate + generated-diff + lint + typecheck + test. Run before every PR
```

There is no Playwright yet; `e2e` arrives with the first journey test.

---

## Layout

```
src/
  app/
    (auth)/             unauthenticated. centred card, no shell (login, accept-invite)
    (app)/              authenticated. sidebar, header, guard
  layout/               AppSidebar, AppHeader, Backdrop -- derived from TailAdmin, ours to edit
  context/              SidebarContext (vendored), ThemeContext (next-themes shim, PATCH 5)
  icons/                VENDORED TailAdmin SVGs, imported via @svgr/webpack
  components/
    ui/{alert,avatar,badge,button,dropdown,modal,table}/   VENDORED TailAdmin
    form/               VENDORED TailAdmin (Label, input/*)
    common/             VENDORED TailAdmin (ComponentCard, PageBreadCrumb, ThemeToggleButton)
    header/             UserDropdown -- derived from TailAdmin, ours to edit
    ui/common/          OURS: Page, Card, Dialog (on the vendored Modal), Field, Listing,
                        ErrorNotice, ButtonLink, Select (Headless UI Listbox), RowMenu
                        (Headless UI Menu), SearchInput, Dropzone, ProgressBar, Stepper
    ui/{catalog,navigation,settings}/   OURS: the screens' components
  lib/
    api/                schema.d.ts (GENERATED) + client.ts (apiFetch, ApiError)
    auth/               session, token refresh, useCan
    utils.ts            cx (clsx + tailwind-merge), nothing else
contracts/              submodule, pinned to a tag -- READ ONLY
```

**Route groups carry the auth boundary.** `(auth)` renders bare; `(app)` renders the shell and
redirects an anonymous visitor to `/login`. The root layout holds only `<html>`, the theme
provider and the session provider, so the login screen does not get a sidebar.

---

## Styling

The UI is **TailAdmin** (free-nextjs-admin-dashboard @ `3f6902572e9d`, the Tailwind-v3
snapshot of the v2 design, MIT -- `LICENSE.md`). The vendored dirs are listed in the layout
above: configure, do not edit. **Every deliberate deviation lives in
`src/components/PATCHES.md`** and is marked `PATCH(new-commerce)` in its file; on a re-pull,
re-apply them. `src/layout/` and `src/components/header/` are derived from TailAdmin's app
chrome and are ours to edit freely. `.prettierignore` keeps prettier away from the vendored
files so re-pull diffs stay honest.

Design tokens come from the TailAdmin theme in `tailwind.config.ts` (brand/gray/success/
error/warning scales, `text-theme-*`, `shadow-theme-*`); `globals.css` carries its `menu-*`
and scrollbar classes. Use the tokens, not raw Tailwind palette colors: errors are
`error-*`, warnings `warning-*`, links and accents `brand-*`. Tables go through
`ui/common/Listing.tsx` (`ListTable`, `th`, `td`). Form controls come from `ui/common/`:
`Select` (a controlled @headlessui/react Listbox — the panel is portalled, so it works inside
table shells and the Modal; there is no native `<select>` left), `Field`'s `Checkbox`/
`Textarea`, `RowMenu` (a row's actions behind three dots), `SearchInput`, `Dropzone`, `ProgressBar`, `Stepper`. `src/lib/utils.ts` holds
`cx`; do not add a second copy.

Tailwind **3**, configured in `tailwind.config.ts`. Dark mode is `next-themes` with
`attribute="class"`; the header's `ThemeToggleButton` flips light/dark and the user menu
offers "Use system theme". The vendored `context/ThemeContext.tsx` is a shim over
next-themes (PATCH 5) -- never mount a second theme provider.

All UI copy is English (BR-016).

---

## TypeScript

`noUncheckedIndexedAccess` is **off**, deliberately. It makes `array[i]` yield "the value or
undefined", so a missing row has to be handled rather than crashing at runtime -- genuinely worth
having.

It was off because the old template's chart components produced 19 errors under it. Those
are gone with the TailAdmin rewrite, so turning it on is now only a matter of fixing our own
code -- a worthwhile follow-up, not yet done.

---

## Hosts and cookies

v2 names separate hosts: the admin at `admin.{domain}`, the API at `https://api.{domain}/v1`
(`04-api-spec.md` §1). The two are same-site, so the refresh token's `SameSite=Lax` cookie still
travels, but the browser call is cross-origin: the API must answer CORS for the admin origin with
credentials. That setup, and the API base URL the client then needs, land with P1-001.

Locally `next.config.ts` rewrites `/v1/*` to `API_ORIGIN`, so `apiFetch` calls relative paths and
dev needs no CORS. Never hardcode `http://localhost:8080` in code.

**Every fetch sets `credentials: "include"`.** Without it the browser does not attach the cookie,
refresh fails, and the failure looks exactly like an expired session.

---

## The session

`src/lib/auth/session.tsx` is the whole of it (BR-022). The access token is a **ref, not state**:
rendering it would put a credential in the React tree where devtools or a serialised error
boundary can surface it, and it changes on every refresh, which would re-render every consumer for
a value none of them display.

On mount the provider calls refresh once. That is what makes a reload keep you signed in -- the
access token is gone, the cookie is not. Refresh rotates, and a reused refresh token revokes the
whole chain, so never call refresh from two places at once.

---

## Server vs client components

**Server Components are the default.** Reach for `"use client"` only when the component needs
state, an effect, or an event handler.

- Dense list views — products, orders — must be fast on first load: the product list API is p95
  < 600 ms at 10k products (P1-030). No client fetch waterfalls. The access token lives only in
  client memory (BR-022), so a server component cannot call the API as the user today; how list
  pages render server-side is decided with the first list screen (P1-033).
- Client components: the variant matrix grid, drag-to-reorder trees, upload widgets, forms with
  live validation.

---

## Data and forms

### The rules that cause the most bugs

1. **Omitting a field ≠ sending `null`** (BR-009). On create, omit empty optional fields; `null`
   is `422`. On `PATCH`, send only what changed; `null` deliberately clears a nullable field
   (`description`, `brand_id`, `sale_price` to end a sale) and is `422` elsewhere. Never echo a
   response back as a `PATCH` body: responses carry `null` for every empty field.
2. **Never send server-managed fields** (BR-008): `id`, `tenant_id`, `version`, `created_at`,
   `updated_at`, `path`, any `*_at` stamp. They are `422` on create and update alike. Slugs are
   editable: a product's (BR-042) -- warn that old links break -- and a brand's, which follows
   its name when omitted (BR-030).
3. **Never send a field the endpoint does not define**: it is `422 unknown_field` (BR-089). Strip
   UI-only state before submit. `price` and `on_sale` are read-only; a manual order never sends
   `unit_price`.
4. **`version` travels in the `If-Match` header, never in the body**, and only for products,
   variants and orders (BR-010); the variant matrix `PUT` sends the product's version. Brands,
   categories, settings, users, media and API keys have no version: last save wins. On
   `409 version_conflict` tell the user the record changed and offer to reload. Do not retry
   silently — that overwrites someone's edit.

### Money

Money is a plain integer of **minor units**, always IDR, with no currency field (BR-006, BR-029):
`"regular_price": 19900000` is Rp 199.000. Divide by 100 to display.

Format through `src/lib/format` (created with the first screen that shows money: `id-ID`, IDR).
Never do arithmetic on a formatted string, never use `parseFloat` on user input — parse to an
integer of minor units at the input boundary and keep it integral all the way to the API.

### Time

Every timestamp arrives as RFC 3339 with `+07:00` (BR-007). Display it in
`session.tenant.timezone`. Any timestamp you send must carry an offset, or it is `422`; a
date-only filter means midnight WIB.

### Lists and jobs

- **Cursor pagination only**: `?limit=` (1–200) and `next_cursor`. No "page N of M".
- Long work answers `202 { job_id }`; poll `GET /v1/jobs/{id}`. Download links expire after 15
  minutes and a fresh `GET` of the job regenerates one (BR-063).
- CSV import: the browser parses only the first rows, for preview and column mapping (BR-044).

### Errors

Responses are RFC 9457 `application/problem+json`. Surface `detail` to the user, and keep
`trace_id` visible somewhere copyable — a support ticket quoting it goes straight to the span.

Map these to real UI rather than a toast:

| Code | UI |
|---|---|
| `validation_failed` | Field-level errors from the `errors` array |
| `unknown_field` | A bug in our client: report it with the `trace_id` |
| `version_conflict` | "This was changed by someone else" + reload action |
| `duplicate_sku` | Highlight the offending grid cell, name the conflicting product |
| `publish_check_failed` | Every failure links to its field or matrix cell (BR-038) |
| `category_in_use` | Show the counts and what to move first (BR-036) |
| `permission_denied` | Do not render the action at all — see below |
| `rate_limited` | Wait `Retry-After`, then let the user retry |

### Permissions

Four roles: owner, admin, ops, viewer (BR-023). Check with `useCan("resource:action")`, which
reads `Session.user.permissions` (the `04-api-spec.md` §3 matrix), and **do not render** actions
the user lacks (BR-025). A disabled button that 403s is worse than an absent one: it advertises a
capability the user does not have and generates support questions. Never hardcode role names; the
role picker renders from `GET /v1/roles`, and order actions from `allowed_transitions`.

`viewer` sees no save control anywhere. `ops` is read-only on the catalog and sees no Team, API
keys, Channels or Settings navigation. Only `owner` changes settings.

---

## Media upload

Uploads go **browser → R2 directly**, never through the API (BR-051). `04-api-spec.md` §8:

```
POST /v1/media/presign   { purpose: "product_image", product_id, mime_type, bytes, sha256 }
                         → { upload_url, r2_key, expires_in }
PUT  <upload_url>        the raw file, with progress
POST /v1/media/confirm   { r2_key, product_id, variant_id } → Media
```

JPEG, PNG or WebP, up to 20 MB. Show real progress from the `PUT`. Never block the form on an
upload — a 5 MB image on Indonesian mobile is slow and the user should keep typing. Derivatives
arrive within ~15 s (BR-052); render a placeholder and let them fill in.

---

## The variant matrix editor

The differentiating screen of Phase 1. Spec: `01-product-requirements.md` §6.2,
`04-api-spec.md` §7.3–7.4, backlog P1-046, P1-047, P1-075.

- Options across the top, values down the side, a spreadsheet grid of SKU / regular price /
  sale price / weight. `price` and `on_sale` are read-only.
- **Paste from Excel** into a column. **Fill-down.** Bulk price adjust by amount or percent, on the
  regular or sale price as the user chooses, with a preview before it applies (BR-046).
- Save is **one** `PUT /v1/products/{id}/variant-matrix` with the whole desired grid and the
  product's version in `If-Match`. The server diffs it; `archive_missing: false` for a filtered
  view. Do not compute create/update/archive client-side and fire N requests.
- The response is per-row. A duplicate SKU fails **that row only** — highlight the cell, name the
  conflicting product, and keep the other rows saved (BR-041).
- Prompt before navigating away with unsaved grid changes.

Target: 100 cells save in under 2 seconds; a 2×5 grid saves in one request.

---

## Never do these

- Edit `src/lib/api/schema.d.ts`. It is generated. Change the contract instead.
- Call the API with raw `fetch`. Use `apiFetch`; raw `fetch` is only for the auth calls inside
  `session.tsx`.
- Store the access token in `localStorage`. It lives in memory; the refresh token is an httpOnly
  cookie set by the server.
- Send `null` for an optional field the user left empty on create.
- Put `version` in a request body.
- Retry a `409` automatically.
- Hardcode a currency symbol or a date format. Use `lib/format`.
- Add a stock, quantity or inventory field to any screen. There is no stock, in any phase
  (BR-017).

`localStorage` is fine for light per-user conveniences — a remembered filter, a collapsed
section, a column layout. Wrap reads and writes in `try/catch` and render correctly when it is
empty.

---

## Scope (v2 screens)

| Phase | Screens |
|---|---|
| 0 Foundation | Sign in, app shell |
| 1 Catalog | Brands (P1-031), categories (P1-032), product list with bulk actions (P1-033, P1-076), product editor (P1-034), variant matrix (P1-046, P1-047), media (P1-048), publish (P1-075), import wizard (P1-074), team (P1-066), onboarding (P1-068), audit log (P1-078) |
| 2 Orders | Order list, detail, manual entry, customers, order export (P1-108…112) |
| 3 Storefront | API keys (P1-201), storefront settings (P1-217), payment attempts (P1-229) |
| 4 · 5 | Channels: marketplace product import (P1-309) |

**Never:** stock, quantities or sold-out (BR-017), marketplace order sync or price push (BR-100),
catalog CSV export to marketplaces (BR-061). Do not tell users stock is "coming"; if it comes up:
stock isn't tracked, archive a variant you no longer have (`01-product-requirements.md` §2.2).
`05-backlog.md` "Out of scope for v2" has the full list and the answers to give.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
