import { describe, expect, it } from "vitest"

import type { BlogPost } from "@/lib/api/types"

import {
  createBodyOf,
  draftOf,
  emptyDraft,
  parseTags,
  patchOf,
  postState,
} from "./post-form"

const post: BlogPost = {
  id: "p1",
  title: "7 Panduan",
  slug: "7-panduan",
  status: "published",
  published_at: "2026-12-24T09:00:00+07:00",
  is_featured: false,
  category: { id: "c1", name: "Bedding tips" },
  author: { id: "u1", name: "Yusuf" },
  cover_url: null,
  cover_r2_key: null,
  excerpt: null,
  excerpt_preview: "Seprai dan selimut…",
  body: "Seprai dan selimut.",
  tags: ["Bedding Tips", "Panduan"],
  products: [
    { id: "a", title: "Plain White", cover_url: null },
    { id: "b", title: "Steel Light", cover_url: null },
  ],
  archived_at: null,
  created_at: "2026-10-01T09:00:00+07:00",
  updated_at: "2026-10-01T09:00:00+07:00",
}

describe("the post form (P1-607)", () => {
  it("a new post sends only what was filled in, and no excerpt when empty (BR-009, BR-132)", () => {
    expect(
      createBodyOf({ ...emptyDraft(), title: "  Hello ", author_id: "u1" }),
    ).toEqual({
      title: "Hello",
      author_id: "u1",
    })
    expect(
      createBodyOf({
        ...emptyDraft(),
        title: "T",
        excerpt: "  ",
        tags: "a, , b",
        status: "published",
        published_at: "2026-12-24T09:00",
        is_featured: true,
        products: post.products,
      }),
    ).toEqual({
      title: "T",
      tags: ["a", "b"],
      status: "published",
      published_at: "2026-12-24T09:00:00+07:00",
      is_featured: true,
      product_ids: ["a", "b"],
    })
  })

  it("an unchanged post patches nothing", () => {
    expect(patchOf(draftOf(post), draftOf(post))).toEqual({})
  })

  it("emptied fields are null; tags and products go whole, in order", () => {
    const d = draftOf(post)
    expect(
      patchOf(d, {
        ...d,
        excerpt: "Written.",
        category_id: "",
        published_at: "",
        tags: "Panduan, Bedding Tips",
        products: [...post.products].reverse(),
      }),
    ).toEqual({
      excerpt: "Written.",
      category_id: null,
      published_at: null,
      tags: ["Panduan", "Bedding Tips"],
      product_ids: ["b", "a"],
    })
    expect(patchOf({ ...d, excerpt: "Old" }, { ...d, excerpt: " " })).toEqual({
      excerpt: null,
    })
  })

  it("parses tags as typed", () => {
    expect(parseTags(" Bedding Tips ,Panduan,, ")).toEqual([
      "Bedding Tips",
      "Panduan",
    ])
  })

  it("names a post's state, a later date being scheduled (BR-131)", () => {
    const now = new Date("2026-12-01T00:00:00+07:00").getTime()
    expect(postState(post, now)).toBe("scheduled")
    expect(
      postState(post, new Date("2027-01-01T00:00:00+07:00").getTime()),
    ).toBe("published")
    expect(
      postState({ status: "draft", published_at: post.published_at }, now),
    ).toBe("draft")
  })
})
