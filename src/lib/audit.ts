import type { AuditEntry } from "@/lib/api/types"

export interface Change {
  field: string
  before: unknown
  after: unknown
}

/**
 * An entry's before and after as a field-by-field list, changed fields only
 * when both sides exist (BR-018).
 */
export function changesOf(e: Pick<AuditEntry, "before" | "after">): Change[] {
  const before = (e.before ?? {}) as Record<string, unknown>
  const after = (e.after ?? {}) as Record<string, unknown>
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return fields
    .map((field) => ({ field, before: before[field], after: after[field] }))
    .filter(
      (c) =>
        !(e.before && e.after) ||
        JSON.stringify(c.before) !== JSON.stringify(c.after),
    )
}

export function show(v: unknown): string {
  if (v === undefined) return ""
  if (v === null) return "—"
  return typeof v === "string" ? v : JSON.stringify(v)
}
