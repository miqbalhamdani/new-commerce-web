import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Settings } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import OnboardingPage from "./page"

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const settings: Settings = {
  id: "t1",
  name: "Erigo",
  slug: "erigo-1a2b3c",
  order_prefix: "ERI",
  timezone: "Asia/Jakarta",
  status: "active",
}

/** A small in-memory shop behind the stubbed fetch: what is posted is listed. */
function shop() {
  const brands: { id: string; name: string; slug: string }[] = []
  const categories: {
    id: string
    name: string
    kind: string
    parent_id: string | null
  }[] = []
  const fetch = mockApi(
    [
      "settings:read",
      "settings:write",
      "brands:write",
      "categories:write",
      "products:write",
    ],
    (url, init) => {
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      if (url.endsWith("/v1/settings") && method === "GET")
        return json(settings)
      if (url.includes("/v1/brands") && method === "GET")
        return json({ data: brands, next_cursor: null })
      if (url.endsWith("/v1/brands") && method === "POST") {
        const b = {
          id: `b${brands.length + 1}`,
          name: body.name,
          slug: body.name.toLowerCase(),
        }
        brands.push(b)
        return json(b, 201)
      }
      if (url.includes("/v1/categories") && method === "GET")
        return json({ data: categories })
      if (url.endsWith("/v1/categories") && method === "POST") {
        const c = {
          id: `c${categories.length + 1}`,
          name: body.name,
          kind: body.kind,
          parent_id: body.parent_id ?? null,
        }
        categories.push(c)
        return json(c, 201)
      }
      if (url.endsWith("/v1/products") && method === "POST")
        return json({ id: "p1", title: body.title, version: 1 }, 201)
      if (url.endsWith("/v1/products/p1/variant-matrix") && method === "PUT")
        return json({ results: [{ status: "created" }] })
      return undefined
    },
    "owner",
  )
  const writes = () =>
    fetch.mock.calls
      .filter(
        ([u, init]) =>
          !String(u).endsWith("/v1/auth/refresh") &&
          init?.method &&
          init.method !== "GET",
      )
      .map(([u, init]) => ({
        url: String(u),
        method: init!.method,
        body: init!.body ? JSON.parse(String(init!.body)) : undefined,
        ifMatch: new Headers(init!.headers).get("If-Match"),
      }))
  return { writes }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("the onboarding wizard (P1-068)", () => {
  it("walks the four steps forward and back without saving anything", async () => {
    const { writes } = shop()
    renderSignedIn(<OnboardingPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Continue" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Brands" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Brands" })).toHaveAttribute(
      "href",
      "/brands",
    )
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByLabelText("Shop name")).toHaveValue("Erigo")

    await userEvent.click(screen.getByRole("button", { name: "Continue" }))
    await userEvent.click(await screen.findByRole("button", { name: "Skip" }))
    expect(
      await screen.findByRole("heading", { name: "Categories" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      await screen.findByRole("heading", { name: "First product" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(
      await screen.findByRole("heading", { name: "Categories" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Skip" }))
    await userEvent.click(await screen.findByRole("button", { name: "Skip" }))
    expect(await screen.findByText("Your shop is set up")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Add your first product" }),
    ).toHaveAttribute("href", "/products/new")

    expect(writes()).toEqual([])
  })

  it("adds brands and categories to the real lists, then creates a priced draft", async () => {
    const { writes } = shop()
    renderSignedIn(<OnboardingPage />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Continue" }),
    )

    // Brands: pre-filled with the shop's name; Add lists it straight away.
    const brandName = await screen.findByLabelText("Brand name")
    await waitFor(() => expect(brandName).toHaveValue("Erigo"))
    await userEvent.click(screen.getByRole("button", { name: "+ Add" }))
    const brandList = await screen.findByRole("list", { name: "Your brands" })
    expect(within(brandList).getByText("Erigo")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Brand name"), "Nike")
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))

    // Categories: a top-level one, then one inside it.
    await userEvent.type(
      await screen.findByLabelText("Category name"),
      "Apparel",
    )
    await userEvent.click(screen.getByRole("button", { name: "+ Add" }))
    await screen.findByRole("list", { name: "Your categories" })
    await userEvent.click(screen.getByLabelText("Put it inside"))
    await userEvent.click(
      await screen.findByRole("option", { name: "Apparel" }),
    )
    await userEvent.type(screen.getByLabelText("Category name"), "Tees")
    await userEvent.click(screen.getByRole("button", { name: "+ Add" }))
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Your categories" })).getByText(
          "Tees",
        ),
      ).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))

    // First product: name, price, the first brand by default, a category.
    await userEvent.type(
      await screen.findByLabelText("Product name"),
      "Basic Tee",
    )
    await userEvent.type(screen.getByLabelText("Price"), "199000")
    expect(screen.getByLabelText("Price")).toHaveValue("199,000")
    await userEvent.click(screen.getByLabelText("Category"))
    await userEvent.click(await screen.findByRole("option", { name: "Tees" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Create product" }),
    )

    expect(await screen.findByText("Your shop is set up")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Finish your product" }),
    ).toHaveAttribute("href", "/products/p1")
    expect(writes()).toEqual([
      {
        url: "/v1/brands",
        method: "POST",
        body: { name: "Erigo" },
        ifMatch: null,
      },
      {
        url: "/v1/brands",
        method: "POST",
        body: { name: "Nike" },
        ifMatch: null,
      },
      {
        url: "/v1/categories",
        method: "POST",
        body: { name: "Apparel", kind: "category" },
        ifMatch: null,
      },
      {
        url: "/v1/categories",
        method: "POST",
        body: { name: "Tees", kind: "category", parent_id: "c1" },
        ifMatch: null,
      },
      {
        url: "/v1/products",
        method: "POST",
        body: { title: "Basic Tee", brand_id: "b1", category_ids: ["c2"] },
        ifMatch: null,
      },
      {
        url: "/v1/products/p1/variant-matrix",
        method: "PUT",
        body: {
          option_names: [],
          rows: [
            {
              option_values: [],
              sku: null,
              regular_price: 19900000,
              sale_price: null,
            },
          ],
          archive_missing: true,
        },
        ifMatch: "1",
      },
    ])
  })
})
