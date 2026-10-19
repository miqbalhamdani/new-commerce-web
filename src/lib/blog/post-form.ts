import type { BlogPost, BlogPostStatus } from "@/lib/api/types"
import { dateTimeInputRFC3339, dateTimeInputValue } from "@/lib/format"

/** A linked product as the editor shows it: a chip with its title. */
export interface PickedProduct {
  id: string
  title: string
  cover_url: string | null
}

/** What the post editor holds while someone types (04-api-spec.md §13.2). */
export interface PostDraft {
  title: string
  slug: string
  excerpt: string
  body: string
  category_id: string
  author_id: string
  /** As typed: comma-separated. */
  tags: string
  status: BlogPostStatus
  /** A datetime-local value in WIB, "" for none. */
  published_at: string
  is_featured: boolean
  products: PickedProduct[]
}

export function draftOf(p: BlogPost): PostDraft {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? "",
    body: p.body,
    category_id: p.category?.id ?? "",
    author_id: p.author?.id ?? "",
    tags: p.tags.join(", "),
    status: p.status,
    published_at: dateTimeInputValue(p.published_at),
    is_featured: p.is_featured,
    products: p.products,
  }
}

/**
 * A new post's form. No author: the API makes it whoever creates the post
 * (BR-133).
 */
export function emptyDraft(): PostDraft {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    category_id: "",
    author_id: "",
    tags: "",
    status: "draft",
    published_at: "",
    is_featured: false,
    products: [],
  }
}

/** "Bedding Tips, , Panduan" -> ["Bedding Tips", "Panduan"]. */
export function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

const ids = (d: PostDraft) => d.products.map((p) => p.id)

/**
 * The POST body for a new post: only what was filled in, so the API's
 * defaults apply to the rest (BR-009). No slug: the API derives it from the
 * title, editable afterwards (BR-131). An empty excerpt is left out, so the
 * post shows the start of its body (BR-132).
 */
export function createBodyOf(d: PostDraft): Record<string, unknown> {
  const body: Record<string, unknown> = { title: d.title.trim() }
  if (d.body !== "") body.body = d.body
  if (d.excerpt.trim() !== "") body.excerpt = d.excerpt.trim()
  if (d.category_id !== "") body.category_id = d.category_id
  if (d.author_id !== "") body.author_id = d.author_id
  const tags = parseTags(d.tags)
  if (tags.length) body.tags = tags
  if (d.status !== "draft") body.status = d.status
  if (d.published_at !== "")
    body.published_at = dateTimeInputRFC3339(d.published_at)
  if (d.is_featured) body.is_featured = true
  if (d.products.length) body.product_ids = ids(d)
  return body
}

/**
 * The PATCH body: only what changed (BR-009). An emptied excerpt, category,
 * author or date is sent as null, which clears it; tags and products go whole,
 * products in their order (BR-134).
 */
export function patchOf(
  original: PostDraft,
  d: PostDraft,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const orNull = (v: string) => (v === "" ? null : v)
  if (d.title.trim() !== original.title) body.title = d.title.trim()
  if (d.slug !== original.slug) body.slug = d.slug
  if (d.excerpt.trim() !== original.excerpt)
    body.excerpt = orNull(d.excerpt.trim())
  if (d.body !== original.body) body.body = d.body
  if (d.category_id !== original.category_id)
    body.category_id = orNull(d.category_id)
  if (d.author_id !== original.author_id) body.author_id = orNull(d.author_id)
  if (parseTags(d.tags).join("\n") !== parseTags(original.tags).join("\n"))
    body.tags = parseTags(d.tags)
  if (d.status !== original.status) body.status = d.status
  if (d.published_at !== original.published_at)
    body.published_at =
      d.published_at === "" ? null : dateTimeInputRFC3339(d.published_at)
  if (d.is_featured !== original.is_featured) body.is_featured = d.is_featured
  if (ids(d).join() !== ids(original).join()) body.product_ids = ids(d)
  return body
}

/** Draft, scheduled or published, as the list and the editor say it (BR-131). */
export function postState(
  p: Pick<BlogPost, "status" | "published_at">,
  now = Date.now(),
): "draft" | "scheduled" | "published" {
  if (p.status === "draft") return "draft"
  return p.published_at && new Date(p.published_at).getTime() > now
    ? "scheduled"
    : "published"
}
