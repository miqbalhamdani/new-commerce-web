/**
 * The client's copy of the database's slugify() (03-erd.md), for previews
 * only: lower-case a-z0-9 joined by hyphens, accents folded ("Café Ñ" ->
 * "cafe-n"). The server stays authoritative when no slug is sent.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * The client's copy of slugify_label() plus the trigger's fallback (03-erd.md
 * §3.7): a category's derived path segment, underscores between words
 * ("Outer Wear" -> "outer_wear"). A preview: the server adds _1, _2 when a
 * sibling already has it (BR-035).
 */
export function pathLabel(text: string): string {
  return slugify(text).replace(/-/g, "_") || "cat"
}
