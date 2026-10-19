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

// ProseMirror needs a real layout; RichTextEditor.test covers the editor
// itself. Here the body is a textarea with the same contract.
vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
  }: {
    id: string
    value: string
    onChange: (v: string) => void
  }) => (
    <textarea
      id={id}
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
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
  const categories = [
    { id: "c1", name: "Bedding tips", slug: "bedding-tips", position: 1 },
  ]
  return mockApi(["blog:read", "blog:write"], (url, init) => {
    if (url.endsWith("/v1/blog/categories") && init?.method === "POST") {
      const c = { id: "c2", name: "Materials", slug: "materials", position: 2 }
      categories.push(c)
      return json(c, 201)
    }
    if (url.endsWith("/v1/blog/categories")) return json({ data: categories })
    return extra?.(url, init)
  })
}

const sent = (fetch: ReturnType<typeof api>, method: string, path: string) => {
  const call = fetch.mock.calls.find(
    ([u, i]) => String(u).endsWith(path) && i?.method === method,
  )
  return JSON.parse(String(call![1]!.body))
}

describe("PostEditor (P1-607)", () => {
  it("shows the excerpt the website will use as the empty excerpt's placeholder (BR-132)", async () => {
    api()
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    // Folded until wanted, its header saying what it holds.
    expect(screen.queryByLabelText("Excerpt")).toBeNull()
    await userEvent.click(
      await screen.findByRole("button", { name: /^Excerpt\s*Automatic/ }),
    )
    const excerpt = screen.getByLabelText("Excerpt")
    expect(excerpt).toHaveValue("")
    expect(excerpt).toHaveAttribute("placeholder", post.excerpt_preview)
  })

  it("Save draft on a draft sends only what changed (BR-009)", async () => {
    const saved = { ...post, body: "Isi baru.", excerpt_preview: "Isi baru." }
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts/p1") && init?.method === "PATCH")
        return json(saved)
    })
    const onSaved = vi.fn()
    renderSignedIn(<PostEditor post={post} onSaved={onSaved} />)

    const save = await screen.findByRole("button", { name: "Save draft" })
    expect(save).toBeDisabled()
    const body = screen.getByLabelText("Body")
    await userEvent.clear(body)
    await userEvent.type(body, "Isi baru.")
    await userEvent.click(save)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(sent(fetch, "PATCH", "/v1/blog/posts/p1")).toEqual({
      body: "Isi baru.",
    })
  })

  it("Publish sends published; a later date makes it Schedule", async () => {
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts/p1") && init?.method === "PATCH")
        return json({ ...post, status: "published" })
    })
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)

    await userEvent.click(
      await screen.findByRole("button", { name: /^Publish\s*Immediately/ }),
    )
    await userEvent.type(screen.getByLabelText("Publish date"), "2099-01-01")
    await userEvent.type(screen.getByLabelText("Publish time"), "09:30")
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Publish\s*1 Jan 2099/ }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Publish immediately instead" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Publish" }))
    await waitFor(() =>
      expect(sent(fetch, "PATCH", "/v1/blog/posts/p1")).toEqual({
        status: "published",
      }),
    )
  })

  it("a live post offers Unpublish and Update, not Publish", async () => {
    const live: BlogPost = {
      ...post,
      status: "published",
      published_at: "2026-10-01T09:00:00+07:00",
    }
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts/p1") && init?.method === "PATCH")
        return json({ ...live, status: "draft" })
    })
    renderSignedIn(<PostEditor post={live} onSaved={vi.fn()} />)
    expect(await screen.findByRole("button", { name: "Update" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    await waitFor(() =>
      expect(sent(fetch, "PATCH", "/v1/blog/posts/p1")).toEqual({
        status: "draft",
      }),
    )
  })

  it("a new post is by its writer, with tags as chips and its slug following the title (BR-133)", async () => {
    const fetch = api((url, init) => {
      if (url.endsWith("/v1/blog/posts") && init?.method === "POST")
        return json({ ...post, id: "p9" }, 201)
    })
    const onSaved = vi.fn()
    renderSignedIn(<PostEditor post={null} onSaved={onSaved} />)

    expect(
      await screen.findByText("Create the post to add a cover."),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: /^Author\s*Budi \(you\)/ }),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Title"), "Panduan Sprei")
    // A new post's slug is shown, editable once it exists.
    expect(screen.getByText("panduan-sprei")).toBeInTheDocument()
    expect(screen.queryByLabelText("Slug")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /^Tags\s*None/ }))
    await userEvent.type(
      screen.getByLabelText("Tags"),
      "Bedding Tips,Panduan{Enter}",
    )
    expect(
      screen.getByRole("button", { name: "Remove Panduan" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(sent(fetch, "POST", "/v1/blog/posts")).toEqual({
      title: "Panduan Sprei",
      author_id: "u1",
      tags: ["Bedding Tips", "Panduan"],
    })
  })

  it("a category added from Manage categories is picked (P1-606)", async () => {
    api()
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    await userEvent.click(
      await screen.findByRole("button", { name: /^Category\s*None/ }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Manage categories" }),
    )
    expect(
      await screen.findByText("Bedding tips", { selector: "span" }),
    ).toBeInTheDocument()
    // No slugs in the modal; the row actions are labelled buttons.
    expect(screen.getByText("Tab order 1")).toBeInTheDocument()
    expect(screen.queryByText("bedding-tips")).toBeNull()
    expect(
      screen.getByRole("button", { name: "Delete Bedding tips" }),
    ).toHaveTextContent("Delete")
    await userEvent.click(
      screen.getByRole("button", { name: "Edit Bedding tips" }),
    )
    expect(screen.getByLabelText("Name")).toHaveValue("Bedding tips")
    expect(screen.getByLabelText("Order")).toHaveValue(1)
    expect(screen.queryByLabelText("Slug")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    await userEvent.click(screen.getByRole("button", { name: "Add category" }))
    // Adding asks for a name and an order; the API derives the slug.
    expect(screen.queryByLabelText("Slug")).toBeNull()
    expect(screen.queryByText("Edit slug")).toBeNull()
    await userEvent.type(screen.getByLabelText("Name"), "Materials")
    await userEvent.click(screen.getByRole("button", { name: "Add category" }))
    await waitFor(() =>
      expect(screen.getByLabelText("Category")).toHaveTextContent("Materials"),
    )
    expect(
      screen.getByRole("button", { name: /^Category\s*Materials/ }),
    ).toBeInTheDocument()
  })

  it("Shop the guide shows what is selected, with a check and a word (BR-134)", async () => {
    api((url) => {
      if (url.includes("/v1/products?"))
        return json({
          data: [
            { id: "a", title: "Plain White", cover_url: null },
            { id: "b", title: "Steel Light", cover_url: null },
          ],
          next_cursor: null,
          total: 2,
        })
    })
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    expect(
      await screen.findByText(/No products linked yet/),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText("Search products to add"))
    await userEvent.click(
      await screen.findByRole("option", { name: /Plain White/ }),
    )
    await userEvent.click(screen.getByRole("option", { name: /Steel Light/ }))
    expect(
      screen.getByRole("option", { name: /Plain White/ }),
    ).toHaveTextContent("Selected")
    expect(screen.getByText("2 of 12 products selected")).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Plain White" }),
    )
    expect(screen.getByText("1 of 12 products selected")).toBeInTheDocument()
    const linked = screen.getByRole("list", { name: "Linked products" })
    expect(linked).toHaveTextContent("Steel Light")
    expect(linked).not.toHaveTextContent("Plain White")
  })

  it("a reader sees the post but no buttons", async () => {
    mockApi(["blog:read"], () => json({ data: [] }))
    renderSignedIn(<PostEditor post={post} onSaved={vi.fn()} />)
    expect(await screen.findByLabelText("Title")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Manage categories" }),
    ).toBeNull()
  })
})
