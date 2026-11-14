import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { json, mockApi, renderSignedIn } from "@/test/api"

import { ProductEditor } from "./ProductEditor"

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/new",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

describe("ProductEditor (new product)", () => {
  it("lays out info, status and organisation, and creates from the status card", async () => {
    const fetch = mockApi(["products:write"], (url, init) => {
      if (url.includes("/v1/brands"))
        return json({ data: [{ id: "b1", name: "Erigo" }], next_cursor: null })
      if (url.endsWith("/v1/categories"))
        return json({
          data: [
            {
              id: "c1",
              name: "Body Care",
              kind: "category",
              parent_id: null,
              path: "body_care",
            },
            {
              id: "c2",
              name: "Body Cream",
              kind: "category",
              parent_id: "c1",
              path: "body_care.body_cream",
            },
          ],
        })
      if (url.endsWith("/v1/products") && init?.method === "POST")
        return json({ id: "p9", title: "Tee" }, 201)
    })
    const onSaved = vi.fn()
    renderSignedIn(<ProductEditor product={null} onSaved={onSaved} />)

    for (const name of [
      "Product info",
      "Images",
      "Variants",
      "Status",
      "Organization",
      "Attributes",
    ])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    expect(
      screen.getByText("Create the product to add variants."),
    ).toBeInTheDocument()

    // The breadcrumb leads back; there is no back button.
    expect(screen.queryByRole("link", { name: "Back to products" })).toBeNull()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.getByText(/Starts as a draft/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Publish product" })).toBeNull()

    const create = await screen.findByRole("button", { name: "Create product" })
    expect(
      screen.getByRole("heading", { name: "Status" }).closest("section"),
    ).toContainElement(create)
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Title"), "Tee")
    expect(screen.getByLabelText("Slug")).toHaveValue("tee")
    await userEvent.click(screen.getByLabelText("Category (main tree)"))
    await userEvent.click(
      await screen.findByRole("option", { name: "Body Cream" }),
    )
    expect(screen.getByLabelText("Category (main tree)")).toHaveTextContent(
      "Body Cream",
    )
    await userEvent.keyboard("{Escape}")
    await userEvent.click(create)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const post = fetch.mock.calls.find(
      ([u, i]) => String(u).endsWith("/v1/products") && i?.method === "POST",
    )
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      title: "Tee",
      category_ids: ["c2"],
    })
  })
})

describe("ProductEditor (an umrah shop, BR-170)", () => {
  it("edits a package: schedule, hotels, itinerary, and saves it whole", async () => {
    const fetch = mockApi(
      ["products:write", "variants:write", "media:write"],
      (url, init) => {
        if (url.includes("/v1/brands")) return json({ data: [], next_cursor: null })
        if (url.endsWith("/v1/categories")) return json({ data: [] })
        if (url.endsWith("/v1/products") && init?.method === "POST")
          return json({ id: "p9", title: "Umrah Desember" }, 201)
      },
      "owner",
      false,
      "katalog",
      "umrah",
    )
    renderSignedIn(<ProductEditor product={null} onSaved={vi.fn()} />)
    const user = userEvent.setup()

    for (const name of ["Package info", "Schedule and seats", "Hotels", "Itinerary", "Prices"])
      expect(await screen.findByRole("heading", { name })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Title"), "Umrah Desember")
    await user.type(screen.getByLabelText("Or departure month"), "Desember 2026")
    await user.type(screen.getByLabelText("Seats left"), "12")
    await user.click(screen.getByRole("button", { name: "Add day" }))
    await user.type(screen.getByLabelText("Day 1 title"), "Jakarta – Madinah")
    await user.click(screen.getByRole("button", { name: "Create package" }))

    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u, i]) => String(u).endsWith("/v1/products") && i?.method === "POST"),
      ).toBe(true),
    )
    const [, init] = fetch.mock.calls.find(
      ([u, i]) => String(u).endsWith("/v1/products") && i?.method === "POST",
    )!
    expect(JSON.parse(String(init?.body)).package).toMatchObject({
      departure_text: "Desember 2026",
      seats_left: 12,
      itinerary: [{ title: "Jakarta – Madinah", text: null }],
    })
  })
})

