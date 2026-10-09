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
  it("renders 10 variants as 10 cards and saves them in one request; a failed card keeps its error", async () => {
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

    await waitFor(() => expect(screen.getAllByRole("group")).toHaveLength(10))
    const price = screen.getByLabelText("Price (Rp) for Black / S")
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
      screen.getByRole("alert").closest("fieldset")?.getAttribute("data-row"),
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

  it("adds a variant card with a value per option, and X removes one", async () => {
    const fetch = mockApi(["variants:write"], (url, init) => {
      if (url.endsWith("/variants")) return json({ data: variants.slice(0, 2) })
      if (url.endsWith("/variant-matrix") && init?.method === "PUT")
        return json({ results: [] })
    })
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove variant Black / S" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }))
    expect(screen.getAllByRole("group")).toHaveLength(2)
    await userEvent.click(screen.getByRole("button", { name: "Save variants" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Fill in Colour")

    await userEvent.type(screen.getByLabelText("Colour for variant 2"), "Red")
    await userEvent.type(screen.getByLabelText("Size for variant 2"), "XL")
    await userEvent.type(
      screen.getByLabelText("Price (Rp) for Red / XL"),
      "99000",
    )
    await userEvent.click(screen.getByRole("button", { name: "Save variants" }))

    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) => String(u).endsWith("/variant-matrix")),
      ).toBe(true),
    )
    const put = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/variant-matrix"),
    )!
    const body = JSON.parse(String(put[1]!.body))
    expect(body.option_names).toEqual(["Colour", "Size"])
    expect(body.archive_missing).toBe(true)
    expect(
      body.rows.map((r: { option_values: string[] }) => r.option_values),
    ).toEqual([
      ["Black", "M"],
      ["Red", "XL"],
    ])
    expect(body.rows[1].regular_price).toBe(9900000)
  })

  it("adding an option gives every card a box for it", async () => {
    mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: [] }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix
        product={{ ...product, option_names: [] }}
        canWrite
        onSaved={() => {}}
      />,
    )
    expect(await screen.findByText(/No variants yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Add variant" }))
    await userEvent.click(screen.getByRole("button", { name: "Add option" }))
    expect(screen.getByLabelText("Option 1 name")).toHaveValue("Colour")
    expect(screen.getByLabelText("Colour for variant 1")).toBeInTheDocument()
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
