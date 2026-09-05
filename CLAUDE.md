# frontend — Next.js admin

Phase 1 · Catalog & Foundation. Next.js 15 App Router · TypeScript · React Server Components.

**The contract lives in `contracts/`** (git submodule, pinned to a tag). The API client is
**generated** from `contracts/openapi.yaml` — never hand-written, never edited. If an endpoint
you need is missing, it is a contract PR, not a `fetch` call.

`contracts/flows.md` is the acceptance reference for every screen. Read the relevant journey
before building one; the acceptance criteria are the definition of done, not suggestions.

---

## Commands

```bash
npm run dev        # localhost:3000, expects the API on :8080
npm run generate   # openapi-typescript → src/lib/api/schema.d.ts. No-op on a clean tree
npm run lint
npm run typecheck
npm run test       # vitest + testing-library
npm run e2e        # playwright
npm run check      # generate + lint + typecheck + test. Run before every PR
```

Where the repo stands today: only `generate`, `typecheck` and `check` are real scripts. `dev`,
`lint`, `test` and `e2e` arrive with P1-014, which brings Next.js, ESLint and Vitest -- there is
no application and no component to run them against yet, and a script that passes because it
found nothing is worse than one that is missing. `check` is therefore generate + generated-diff
+ typecheck for now.

---

## Layout

```
src/
  app/                    App Router. Server Components by default
    (auth)/               login, accept-invite — unauthenticated
    (app)/                authenticated shell
      products/           list, [id] editor, [id]/variants matrix
      categories/ brands/ media/ export/ settings/
  components/
    ui/                   primitives — no domain knowledge
    <domain>/             ProductForm, VariantMatrix, CategoryTree …
  lib/
    api/                  GENERATED client + a thin typed wrapper. Do not edit schema.d.ts
    auth/                 session, token refresh
    format/               money, dates, numbers
contracts/                submodule, pinned to a tag — READ ONLY
```

---

## Server vs client components

**Server Components are the default.** Reach for `"use client"` only when the component needs
state, an effect, or an event handler.

- Dense list views — products, categories, media — are server-rendered. The product list must
  hit p95 < 600ms first byte at 10k products, and a client-side fetch waterfall will not.
- Client components: the variant matrix grid, drag-to-reorder trees, upload widgets, forms with
  live validation.
- Never fetch in a `useEffect` for data the server could have rendered.

---

## Data and forms

### The three rules that cause the most bugs

1. **Omitting a field ≠ sending `null`.** An absent key takes the server default; an explicit
   `null` is a `422`. Strip empty optional fields before submit — do not send `null` for "the
   user did not fill this in".
2. **Never send server-managed fields**: `id`, `tenant_id`, `version`, `created_at`,
   `updated_at`, `path`. They are ignored on create and rejected on update.
3. **`version` travels in the `If-Match` header, never in the body.** Hold the version from the
   last read, send it on `PATCH`, and on `409 version_conflict` tell the user the record changed
   and offer to reload. Do not retry silently — that overwrites someone's edit.

### Money

`{"amount": 19900000, "currency": "IDR"}` is integer **minor units**. Rp 199.000 is `19900000`.

Format through `lib/format/money`. Never do arithmetic on a formatted string, never use
`parseFloat` on user input — parse to an integer of minor units at the input boundary and keep
it integral all the way to the API.

### Errors

Responses are RFC 9457 `application/problem+json`. Surface `detail` to the user, and keep
`trace_id` visible somewhere copyable — a support ticket quoting it goes straight to the span.

Map these to real UI rather than a toast:

| Code | UI |
|---|---|
| `validation_failed` | Field-level errors from the `errors` array |
| `version_conflict` | "This was changed by someone else" + reload action |
| `duplicate_sku` | Highlight the offending grid cell, name the conflicting product |
| `permission_denied` | Do not render the action at all — see below |

### Permissions

Check permissions from `/v1/me` and **do not render** actions the user lacks. A disabled button
that 403s is worse than an absent one: it advertises a capability the user does not have and
generates support questions.

`viewer` sees no save controls anywhere. `ops` sees no Team or API-keys navigation.

---

## Media upload

Uploads go **browser → R2 directly**, never through the API.

```
POST /v1/media/presign   → { upload_url, r2_key }
PUT  <upload_url>        → the raw file, with progress
POST /v1/media/confirm   → { r2_key, product_id }
```

Show real progress from the `PUT`. Never block the form on an upload — a 5 MB image on Indonesian
mobile is slow and the user should keep typing. Derivatives arrive asynchronously; render a
placeholder and let them fill in.

---

## The variant matrix editor

The differentiating screen of Phase 1. `contracts/flows.md` §3 is the spec.

- Options across the top, values down the side, a spreadsheet grid of SKU / price / weight.
- **Paste from Excel** into a column. **Fill-down.** Bulk price adjust by amount or percent.
- Save is **one** `PUT /v1/products/{id}/variant-matrix` with the whole desired grid. The server
  diffs it. Do not compute create/update/archive client-side and fire N requests.
- The response is per-row. A duplicate SKU fails **that row only** — highlight the cell, name the
  conflicting product, and keep the other rows saved.
- Prompt before navigating away with unsaved grid changes.

Target: a 2×5 grid saves in under 2 seconds.

---

## Never do these

- Edit `src/lib/api/schema.d.ts`. It is generated. Change the contract instead.
- Call `fetch` against the API directly. Use the generated client.
- Store the access token in `localStorage`. It lives in memory; the refresh token is an httpOnly
  cookie set by the server.
- Send `null` for an optional field the user left empty.
- Put `version` in a request body.
- Retry a `409` automatically.
- Hardcode a currency symbol or a date format. Use `lib/format`, which reads the tenant's
  timezone and currency.
- Add a stock, quantity or inventory field to any screen. There is no stock in Phase 1.

`localStorage` is fine for light per-user conveniences — a remembered filter, a collapsed
section, a column layout. Wrap reads and writes in `try/catch` and render correctly when it is
empty.

---

## Phase 1 scope guard

No stock. No orders. No marketplace channel connections. No CSV import, no bulk edit.

The product list has **no bulk action tray** in this phase — that is P2. If a design shows one,
it is ahead of the backlog.

Empty states must carry the honest message: stock is not tracked yet, and merchants continue
managing quantity on their marketplaces. `contracts/flows.md` §7 lists what users will ask for
and what to answer. Putting it in the UI is cheaper than answering it in support.
