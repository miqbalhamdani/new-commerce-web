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
  it("lays out info, status and organisation, and creates from the header", async () => {
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

    const create = await screen.findByRole("button", { name: "Create product" })
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
