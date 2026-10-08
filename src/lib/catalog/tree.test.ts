import { describe, expect, it } from "vitest"

import type { Category } from "@/lib/api/types"

import { buildTree, isSelfOrDescendant, moveMessage } from "./tree"

const cat = (id: string, parent: string | null, name = id): Category => ({
  id, parent_id: parent, name, kind: "category", path: name, archived_at: null,
  created_at: "2026-10-06T16:15:00+07:00", updated_at: "2026-10-06T16:15:00+07:00",
})

const list = [cat("apparel", null), cat("outer", "apparel"), cat("jackets", "outer"), cat("tees", "apparel"), cat("sale", null)]

describe("buildTree", () => {
  it("nests by parent_id and keeps the list's order", () => {
    const tree = buildTree(list)
    expect(tree.map((n) => n.category.id)).toEqual(["apparel", "sale"])
    expect(tree[0].children.map((n) => n.category.id)).toEqual(["outer", "tees"])
    expect(tree[0].children[0].children[0].category.id).toBe("jackets")
  })
  it("treats an orphan as a root", () => {
    expect(buildTree([cat("jackets", "missing")])[0].category.id).toBe("jackets")
  })
})

describe("isSelfOrDescendant", () => {
  it("blocks moving a node under itself or its descendants", () => {
    expect(isSelfOrDescendant(list, "apparel", "jackets")).toBe(true)
    expect(isSelfOrDescendant(list, "outer", "outer")).toBe(true)
    expect(isSelfOrDescendant(list, "outer", "tees")).toBe(false)
    expect(isSelfOrDescendant(list, "jackets", "sale")).toBe(false)
  })
})

describe("moveMessage", () => {
  it("states descendant and product counts (BR-033)", () => {
    expect(moveMessage("Jackets", "Outerwear", 4, 128)).toEqual({
      title: "Move Jackets and its 4 subcategories under Outerwear?",
      detail: "128 products keep their assignments.",
    })
    expect(moveMessage("Tees", null, 1, 1)).toEqual({
      title: "Move Tees and its 1 subcategory to the top level?",
      detail: "1 product keeps its assignments.",
    })
  })
})
