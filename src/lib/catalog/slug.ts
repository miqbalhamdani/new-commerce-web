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
