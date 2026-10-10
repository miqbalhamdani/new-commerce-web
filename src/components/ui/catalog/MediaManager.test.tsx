import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Product } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import { MediaManager } from "./MediaManager"

const image = (id: string) => ({
  id,
  variant_id: null,
  url: `/${id}.jpg`,
  derivatives: {},
})
const product = {
  id: "p1",
  media: [image("m1"), image("m2")],
} as unknown as Product

beforeEach(() => vi.unstubAllGlobals())

describe("MediaManager (P1-048)", () => {
  it("marks the cover and deletes an image only after confirming", async () => {
    const fetch = mockApi(["media:write"], (url, init) => {
      if (url.endsWith("/variants")) return json({ data: [] })
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
    })
    const deleted = () =>
      fetch.mock.calls.filter(([, i]) => i?.method === "DELETE")
    const onChanged = vi.fn()
    renderSignedIn(
      <MediaManager product={product} canWrite onChanged={onChanged} />,
    )
    expect(screen.getByAltText("Image 1, cover")).toBeInTheDocument()
    expect(screen.getAllByText("Cover")).toHaveLength(1)

    await userEvent.click(
      screen.getByRole("button", { name: "Delete image 1" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(deleted()).toHaveLength(0)

    await userEvent.click(
      screen.getByRole("button", { name: "Delete image 1" }),
    )
    expect(screen.getByText("Delete image 1?")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Delete image" }))
    expect(String(deleted()[0][0])).toMatch(/\/v1\/media\/m1$/)
    expect(onChanged).toHaveBeenCalled()
  })
})
