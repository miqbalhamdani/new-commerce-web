import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BlogPost } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import { PostEditor } from "./PostEditor"

vi.mock("next/navigation", () => ({
  usePathname: () => "/blog/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const post: BlogPost = {
  id: "p1",
  title: "7 Panduan",
  slug: "7-panduan",
  status: "draft",
  published_at: null,
  is_featured: false,
  category: null,
  author: { id: "u1", name: "Budi" },
  cover_url: null,
  cover_r2_key: null,
  excerpt: null,
  excerpt_preview: "Seprai dan selimut merupakan sarana pelengkap…",
  body: "Seprai dan selimut merupakan sarana pelengkap.",
  tags: [],
  products: [],
  archived_at: null,
  created_at: "2026-10-01T09:00:00+07:00",
  updated_at: "2026-10-01T09:00:00+07:00",
}

function api(
  extra?: (url: string, init?: RequestInit) => Response | undefined,
) {
  return mockApi(["blog:read", "blog:write"], (url, init) => {
    if (url.endsWith("/v1/blog/categories"))
      return json({
        data: [
          { id: "c1", name: "Bedding tips", slug: "bedding-tips", position: 1 },
        ],
      })
    return extra?.(url, init)
  })
}

describe("PostEditor (P1-607)", () => {
  it("shows the excerpt the website will use as the empty excerpt's placeholder (BR-132)", async () => {
    api()
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    const excerpt = await screen.findByLabelText("Excerpt")
    expect(excerpt).toHaveValue("")
    expect(excerpt).toHaveAttribute("placeholder", post.excerpt_preview)
  })

  it("saves only what changed, and leaves an empty excerpt out (BR-009)", async () => {
    const saved = { ...post, body: "Isi baru.", excerpt_preview: "Isi baru." }
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts/p1") && init?.method === "PATCH")
        return json(saved)
    })
    const onSaved = vi.fn()
    renderSignedIn(<PostEditor post={post} onSaved={onSaved} />)

    const body = await screen.findByLabelText("Body")
    await userEvent.clear(body)
    await userEvent.type(body, "Isi baru.")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    const patch = fetch.mock.calls.find(
      ([u, i]) =>
        String(u).endsWith("/v1/blog/posts/p1") && i?.method === "PATCH",
    )
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ body: "Isi baru." })
  })

  it("a new post is created as typed, its slug following the title", async () => {
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts") && init?.method === "POST")
        return json({ ...post, id: "p9" }, 201)
    })
    const onSaved = vi.fn()
    renderSignedIn(<PostEditor post={null} onSaved={onSaved} />)

    expect(
      await screen.findByText("Create the post to add a cover."),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Title"), "Panduan Sprei")
    expect(screen.getByLabelText("Slug")).toHaveValue("panduan-sprei")
    await userEvent.type(screen.getByLabelText("Tags"), "Bedding Tips, Panduan")
    await userEvent.click(screen.getByRole("button", { name: "Create post" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const create = fetch.mock.calls.find(
      ([u, i]) => String(u).endsWith("/v1/blog/posts") && i?.method === "POST",
    )
    // No author_id: the API makes the creator the author (BR-133).
    expect(JSON.parse(String(create![1]!.body))).toEqual({
      title: "Panduan Sprei",
      tags: ["Bedding Tips", "Panduan"],
    })
  })

  it("a reader sees the post but no save", async () => {
    mockApi(["blog:read"], () => json({ data: [] }))
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    expect(await screen.findByLabelText("Title")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })
})
