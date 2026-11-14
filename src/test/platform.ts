// Test fixtures for the platform pages: a report of four shops.

export const now = new Date().toISOString()
export const longAgo = "2026-01-01T09:00:00+07:00"

export const shop = (
  id: string,
  name: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  name,
  slug: id,
  status: "active",
  plan: "jualan",
  plan_until: null,
  business_type: "retail",
  created_at: now,
  source: "email",
  owner: {
    name: `${name} owner`,
    email: `${id}@example.com`,
    status: "active",
    last_login_at: now,
  },
  website: { theme: "katalog", logo: true, whatsapp: false, set_up: true },
  products: { active: 3, total: 4, first_at: now },
  orders: { total: 1, last_30d: 1, first_at: now, last_at: now },
  last_activity_at: now,
  ...over,
})

export const report = {
  generated_at: now,
  summary: {
    shops: 3,
    new_7d: 2,
    new_30d: 3,
    verified: 2,
    website_set_up: 1,
    with_products: 1,
    with_orders: 1,
    active_7d: 1,
    sleeping: 1,
  },
  shops: [
    shop("lelap", "Lelap"),
    shop("kirana", "Kirana", {
      owner: {
        name: "Rina",
        email: "rina@kirana.id",
        status: "invited",
        last_login_at: null,
      },
      last_activity_at: null,
    }),
    shop("seruni", "Seruni", { last_activity_at: longAgo }),
    shop("sahira", "Sahira", { source: "cli" }),
  ],
}
