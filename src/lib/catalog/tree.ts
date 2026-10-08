import type { Category } from "@/lib/api/types"

export interface TreeNode {
  category: Category
  children: TreeNode[]
}

/**
 * The tree the list describes. The API sends categories flat and sorted by
 * path; parent_id is the truth (04-api-spec.md §6.2). Children keep the
 * list's order. A node whose parent is not in the list is a root, so a
 * filtered list still renders.
 */
export function buildTree(categories: Category[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  for (const c of categories) nodes.set(c.id, { category: c, children: [] })
  const roots: TreeNode[] = []
  for (const c of categories) {
    const node = nodes.get(c.id)!
    const parent = c.parent_id ? nodes.get(c.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/**
 * Whether target is node itself or below it: a move there would make a cycle,
 * which the client blocks before the server refuses it (BR-034).
 */
export function isSelfOrDescendant(
  categories: Category[],
  nodeId: string,
  targetId: string,
): boolean {
  const parent = new Map(categories.map((c) => [c.id, c.parent_id]))
  for (let at: string | null | undefined = targetId; at; at = parent.get(at)) {
    if (at === nodeId) return true
  }
  return false
}

/**
 * The move confirmation (BR-033): what moves, where, and that products keep
 * their assignments -- "Move Jackets and its 4 subcategories under
 * Outerwear?" / "128 products keep their assignments."
 */
export function moveMessage(
  name: string,
  parent: string | null,
  descendants: number,
  products: number,
) {
  const subs = descendants
    ? ` and its ${descendants} subcategor${descendants === 1 ? "y" : "ies"}`
    : ""
  const where = parent ? ` under ${parent}` : " to the top level"
  return {
    title: `Move ${name}${subs}${where}?`,
    detail: `${products} product${products === 1 ? "" : "s"} keep${products === 1 ? "s" : ""} ${products === 1 ? "its" : "their"} assignments.`,
  }
}
