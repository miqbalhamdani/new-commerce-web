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
    const price = screen.getByLabelText("Regular price for Black / S")
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
    const first = await screen.findByLabelText("Weight for Black / S")
    first.focus()
    await userEvent.paste("210\n220\n230")
    expect(screen.getByLabelText("Weight for Black / M")).toHaveValue("220")
    expect(screen.getByLabelText("Weight for Black / L")).toHaveValue("230")
  })

  it("adds option values on comma and on leaving the box, not only Enter", async () => {
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
    await userEvent.click(
      await screen.findByRole("button", { name: "Add option" }),
    )
    await userEvent.type(
      screen.getByLabelText("Add a Colour value"),
      "Red, Blue,",
    )
    await userEvent.click(screen.getByRole("button", { name: "Add option" }))
    await userEvent.type(screen.getByLabelText("Add a Size value"), "M")
    await userEvent.tab() // blur commits "M"
    expect(
      screen.getByRole("heading", { name: "Variants (2)" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("SKU for Blue / M")).toBeInTheDocument()
  })

  it("removes a variant only after confirming, and can show it again", async () => {
    const fetch = mockApi(["variants:write"], (url, init) => {
      if (url.endsWith("/variants")) return json({ data: variants })
      if (url.endsWith("/variant-matrix") && init?.method === "PUT")
        return json({ results: [] })
    })
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(11))

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Black / S" }),
    )
    expect(
      screen.getByRole("heading", { name: "Remove Black / S?" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getAllByRole("row")).toHaveLength(11)

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Black / S" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Remove variant" }),
    )
    expect(screen.getAllByRole("row")).toHaveLength(10)
    expect(screen.queryByLabelText("SKU for Black / S")).toBeNull()

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
    expect(body.rows).toHaveLength(9)
    expect(body.archive_missing).toBe(true)
  })

  it("brings removed variants back", async () => {
    mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove White / XXL" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Remove variant" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Show 1 removed" }),
    )
    expect(screen.getByLabelText("SKU for White / XXL")).toBeInTheDocument()
  })

  it("keeps a typed price when an option is added, and copies it to the new rows", async () => {
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
    await userEvent.click(
      await screen.findByRole("button", { name: "Add option" }),
    )
    await userEvent.type(screen.getByLabelText("Add a Colour value"), "Red,")
    const price = screen.getByLabelText("Regular price for Red")
    await userEvent.type(price, "150000")
    expect(price).toHaveValue("150,000")

    await userEvent.click(screen.getByRole("button", { name: "Add option" }))
    expect(screen.getByLabelText("Regular price for Red")).toHaveValue(
      "150,000",
    )
    await userEvent.type(screen.getByLabelText("Add a Size value"), "S, M,")
    expect(screen.getByLabelText("Regular price for Red / S")).toHaveValue(
      "150,000",
    )
    expect(screen.getByLabelText("Regular price for Red / M")).toHaveValue(
      "150,000",
    )
  })

  it("asks before removing an option or a value", async () => {
    mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove option Size" }),
    )
    expect(
      screen.getByRole("heading", { name: "Remove the Size option?" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getAllByRole("row")).toHaveLength(11)

    await userEvent.click(screen.getByRole("button", { name: "Remove XXL" }))
    expect(screen.getByText(/2 variants with XXL go/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Remove value" }))
    expect(screen.getAllByRole("row")).toHaveLength(9)

    await userEvent.click(
      screen.getByRole("button", { name: "Remove option Size" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Remove option" }))
    expect(screen.getAllByRole("row")).toHaveLength(3)
    // Black keeps the row typed for Black / S.
    expect(screen.getByLabelText("SKU for Black")).toHaveValue("TS-Black-S")
  })

  it("selects every variant from the header", async () => {
    mockApi(["variants:write"], (url) =>
      url.endsWith("/variants") ? json({ data: variants }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix product={product} canWrite onSaved={() => {}} />,
    )
    const all = await screen.findByLabelText("Select all variants")
    await userEvent.click(screen.getByLabelText("Select Black / S"))
    expect(all).toHaveProperty("indeterminate", true)
    await userEvent.click(all)
    expect(screen.getByText("10 of 10 selected")).toBeInTheDocument()
    await userEvent.click(all)
    expect(screen.getByText(/No rows ticked/)).toBeInTheDocument()
  })

  it("attaches an uploaded image to a saved variant, and takes it off", async () => {
    const image = (id: string, variant_id: string | null) => ({
      id,
      variant_id,
      url: `/${id}.jpg`,
      derivatives: {},
    })
    const withMedia = {
      ...product,
      media: [image("m1", null), image("m2", "White-S")],
    } as unknown as Product
    const patches: { url: string; body: unknown }[] = []
    mockApi(["variants:write", "media:write"], (url, init) => {
      if (url.endsWith("/variants")) return json({ data: variants })
      if (init?.method === "PATCH") {
        patches.push({ url, body: JSON.parse(String(init.body)) })
        return json({})
      }
    })
    const onSaved = vi.fn()
    renderSignedIn(
      <VariantMatrix product={withMedia} canWrite canMedia onSaved={onSaved} />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Add image for Black / S" }),
    )
    // m2 is on White / S; picking m1 attaches it here.
    expect(
      screen.getByRole("button", { name: "Use image 2, now on White / S" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Use image 1" }))
    expect(patches[0]).toEqual({
      url: expect.stringMatching(/\/v1\/media\/m1$/),
      body: { variant_id: "Black-S" },
    })
    expect(onSaved).toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole("button", { name: "Change image for White / S" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Use no image" }))
    expect(patches[1]).toEqual({
      url: expect.stringMatching(/\/v1\/media\/m2$/),
      body: { variant_id: null },
    })
  })

  it("waits for a variant to be saved before it can have an image", async () => {
    mockApi(["variants:write", "media:write"], (url) =>
      url.endsWith("/variants") ? json({ data: [] }) : undefined,
    )
    renderSignedIn(
      <VariantMatrix
        product={{ ...product, option_names: [], media: [] } as Product}
        canWrite
        canMedia
        onSaved={() => {}}
      />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Add option" }),
    )
    await userEvent.type(screen.getByLabelText("Add a Colour value"), "Red,")
    expect(
      screen.getByRole("button", { name: "Add image for Red" }),
    ).toBeDisabled()
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
