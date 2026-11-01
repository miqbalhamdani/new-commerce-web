import type { ShopTheme } from "@/lib/api/types"

export type Theme = {
  key: ShopTheme
  name: string
  /** What kind of shop it was made for: the admin's recommendation (BR-143). */
  suits: string
  /** Its four colours, the default first (BR-143). */
  colors: [string, string, string, string]
  /** The demo shop drawn in it, at {demo}.belli.id. */
  demo: string
}

/** The hosted website's themes, as BR-143 lists them. */
export const themes: Theme[] = [
  {
    key: "busana",
    name: "Busana",
    suits: "Busana muslim and hijab",
    colors: ["#6e4b3a", "#3f5a4c", "#7a3e52", "#26364f"],
    demo: "sahira",
  },
  {
    key: "clothing",
    name: "Clothing",
    suits: "Everyday clothing, t-shirts, unisex",
    colors: ["#2d5b8a", "#121212", "#4e5b31", "#a4472a"],
    demo: "lantaidua",
  },
  {
    key: "woman",
    name: "Woman",
    suits: "Women's fashion and boutiques",
    colors: ["#8c6e57", "#141414", "#6e2f3c", "#55624a"],
    demo: "kirana",
  },
  {
    key: "katalog",
    name: "Katalog",
    suits: "Skincare, cosmetics, any shop",
    colors: ["#2f5a4c", "#9a4e3a", "#6a3e5e", "#2d4a6e"],
    demo: "seruni",
  },
  {
    key: "katalog-hangat",
    name: "Katalog Hangat",
    suits: "Premium beauty, editorial brands",
    colors: ["#4a2318", "#2f4a3a", "#3d2f5a", "#8a4b22"],
    demo: "sekarayu",
  },
  {
    key: "furnitur",
    name: "Furnitur Klasik",
    suits: "Furniture and home decor",
    colors: ["#8a5a3b", "#5e6b4e", "#34505f", "#1e1c1a"],
    demo: "kayuna",
  },
  {
    key: "furnitur-earthy",
    name: "Furnitur Earthy",
    suits: "Teak and rattan furniture, crafts",
    colors: ["#8b4426", "#5f6347", "#1c1a15", "#9a6b3f"],
    demo: "wanajati",
  },
  {
    key: "furnitur-ceria",
    name: "Furnitur Ceria",
    suits: "Modern homeware",
    colors: ["#0b55c4", "#14171f", "#0e7c66", "#c8442b"],
    demo: "ruangrotan",
  },
]

export const themeOf = (key: string): Theme =>
  themes.find((t) => t.key === key) ?? themes[3]
