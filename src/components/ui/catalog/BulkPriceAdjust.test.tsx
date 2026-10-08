import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Product, Variant } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import { BulkPriceAdjust } from "./BulkPriceAdjust"
import { VariantMatrix } from "./VariantMatrix"

const product = {
  id: "p1",
  version: 1,
  option_names: ["Size"],
} as unknown as Product
const variants = ["S", "M"].map(
  (s) =>
    ({
      id: s,
      option_values: [s],
      sku: s,
      regular_price: 20000000,
      sale_price: null,
      weight_grams: 200,
    }) as unknown as Variant,
)

beforeEach(() => vi.unstubAllGlobals())

describe("BulkPriceAdjust (P1-047)", () => {
  it("previews before applying, on the price the person chose", async () => {
    const fetch = mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}}>
        {(grid) => <BulkPriceAdjust {...grid} />}
      </VariantMatrix>,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Adjust prices" }),
    )
    await userEvent.selectOptions(screen.getByLabelText("Price"), "sale_price")
    const preview = screen.getByRole("table", { name: "Preview" })
    expect(within(preview).getAllByRole("row")).toHaveLength(3)
    expect(preview).toHaveTextContent("Rp 180.000")
    expect(screen.getByLabelText("Sale price (Rp) for S")).toHaveValue("") // nothing applied yet

    await userEvent.click(
      screen.getByRole("button", { name: "Apply to 2 variants" }),
    )
    expect(screen.getByLabelText("Sale price (Rp) for S")).toHaveValue("180000")
    expect(screen.getByLabelText("Regular price (Rp) for S")).toHaveValue(
      "200000",
    )
    expect(fetch.mock.calls.some(([, i]) => i?.method === "PUT")).toBe(false) // saving is still the person's call
  })
})
