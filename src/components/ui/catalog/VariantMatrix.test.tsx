import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Product, Variant } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import { VariantMatrix } from "./VariantMatrix"

const product = {
  id: "p1",
  version: 3,
  option_names: ["Colour", "Size"],
} as unknown as Product
const sizes = ["S", "M", "L", "XL", "XXL"]
const variants: Variant[] = ["Black", "White"].flatMap((c) =>
  sizes.map(
    (s) =>
      ({
        id: `${c}-${s}`,
        option_values: [c, s],
        sku: `TS-${c}-${s}`,
        regular_price: 19900000,
        sale_price: null,
        weight_grams: 200,
      }) as unknown as Variant,
  ),
)

beforeEach(() => vi.unstubAllGlobals())

describe("VariantMatrix (P1-046)", () => {
  it("renders a 2×5 grid as 10 rows and saves it in one request; a failed row shows its error", async () => {
    const fetch = mockApi(["variants:write"], (url, init) => {
      if (url.endsWith("/variants")) return json({ data: variants })
      if (url.endsWith("/variant-matrix") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body))
        return json({
          product_version: 4,
          created: 0,
          updated: 10,
          restored: 0,
          unchanged: 0,
          archived: 0,
          failed: 1,
          archived_variant_ids: [],
          results: body.rows.map((r: { option_values: string[] }, i: number) =>
            i === 3
              ? {
                  option_values: r.option_values,
                  status: "error",
                  variant_id: null,
                  code: "duplicate_sku",
                  detail: "SKU TS-X is used by Oversize Tee",
                }
              : {
                  option_values: r.option_values,
                  status: "updated",
                  variant_id: "x",
                },
          ),
        })
      }
    })
    const onSaved = vi.fn()
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={onSaved} />,
    )

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(11)) // header + 10
    const price = screen.getByLabelText("Regular price (Rp) for Black / S")
    await userEvent.clear(price)
    await userEvent.type(price, "219000")
    await userEvent.click(screen.getByRole("button", { name: "Save variants" }))

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "SKU TS-X is used by Oversize Tee",
      ),
    )
    const puts = fetch.mock.calls.filter(
      ([u, i]) => String(u).endsWith("/variant-matrix") && i?.method === "PUT",
    )
    expect(puts).toHaveLength(1)
    const body = JSON.parse(String(puts[0][1]!.body))
    expect(body.rows).toHaveLength(10)
    expect(body.rows[0].regular_price).toBe(21900000)
    expect(new Headers(puts[0][1]!.headers).get("If-Match")).toBe("3")
    expect(
      screen.getByRole("alert").closest("tr")?.getAttribute("data-row"),
    ).toBe("3")
    expect(onSaved).toHaveBeenCalled()
  })

  it("pastes an Excel block down a column", async () => {
    mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    const first = await screen.findByLabelText("Weight (g) for Black / S")
    first.focus()
    await userEvent.paste("210\n220\n230")
    expect(screen.getByLabelText("Weight (g) for Black / M")).toHaveValue("220")
    expect(screen.getByLabelText("Weight (g) for Black / L")).toHaveValue("230")
  })

  it("shows no write controls without variants:write", async () => {
    mockApi(["variants:read"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite={false} onSaved={() => {}} />,
    )
    await screen.findByLabelText("SKU for Black / S")
    expect(screen.queryByRole("button", { name: "Save variants" })).toBeNull()
  })
})
