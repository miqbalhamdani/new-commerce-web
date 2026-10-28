import { describe, expect, it } from "vitest"

import { demoCredentials } from "./demo"

describe("demo links", () => {
  it("reads a demo account from ?u=&p=", () => {
    expect(demoCredentials("?u=viewer@demo.belli.id&p=s3cret-demo")).toEqual({
      email: "viewer@demo.belli.id",
      password: "s3cret-demo",
    })
  })

  it("normalises the email", () => {
    expect(demoCredentials("?u=%20Viewer@Demo.Belli.ID&p=x")?.email).toBe(
      "viewer@demo.belli.id",
    )
  })

  it("refuses accounts outside the demo domain", () => {
    expect(demoCredentials("?u=ops@erigo.co.id&p=x")).toBeNull()
    expect(demoCredentials("?u=x@notdemo.belli.id&p=x")).toBeNull()
    expect(demoCredentials("?u=x@demo.belli.id.evil.com&p=x")).toBeNull()
  })

  it("needs both parts", () => {
    expect(demoCredentials("?u=viewer@demo.belli.id")).toBeNull()
    expect(demoCredentials("?p=x")).toBeNull()
    expect(demoCredentials("")).toBeNull()
  })
})
