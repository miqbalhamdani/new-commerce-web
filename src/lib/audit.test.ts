import { describe, expect, it } from "vitest"

import { changesOf, show } from "./audit"

describe("changesOf (P1-078)", () => {
  it("lists only the fields that changed", () => {
    expect(
      changesOf({
        before: { name: "A", slug: "a", n: 1 },
        after: { name: "B", slug: "a", n: 1 },
      }),
    ).toEqual([{ field: "name", before: "A", after: "B" }])
  })
  it("lists every field of a create or a delete", () => {
    expect(changesOf({ before: null, after: { name: "A" } })).toEqual([
      { field: "name", before: undefined, after: "A" },
    ])
  })
  it("shows null as a dash", () => {
    expect(show(null)).toBe("—")
    expect(show(["Black", "S"])).toBe('["Black","S"]')
  })
})
