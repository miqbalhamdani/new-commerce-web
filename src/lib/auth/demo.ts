/**
 * Demo links: the belli.id landing page links to `/login?u=…&p=…` so a visitor opens the demo shop
 * without typing. Only demo-domain accounts qualify, so a crafted link cannot sign a visitor into
 * somebody else's real shop (login CSRF).
 */
export const DEMO_DOMAIN = "@demo.belli.id"

export function demoCredentials(
  search: string,
): { email: string; password: string } | null {
  const params = new URLSearchParams(search)
  const email = (params.get("u") ?? "").trim().toLowerCase()
  const password = params.get("p") ?? ""
  if (!email.endsWith(DEMO_DOMAIN) || !password) return null
  return { email, password }
}
