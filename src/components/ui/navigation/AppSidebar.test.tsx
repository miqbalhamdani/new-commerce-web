import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/Sidebar"
import { mockApi, renderSignedIn } from "@/test/api"

import { AppSidebar } from "./AppSidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ push: vi.fn() }),
}))

const perms = {
  owner: [
    "products:read",
    "categories:read",
    "brands:read",
    "users:read",
    "settings:read",
    "settings:write",
    "audit_log:read",
  ],
  admin: [
    "products:read",
    "categories:read",
    "brands:read",
    "users:read",
    "settings:read",
    "audit_log:read",
  ],
  ops: [
    "products:read",
    "categories:read",
    "brands:read",
    "orders:read",
    "orders:write",
  ],
  viewer: ["products:read", "categories:read", "brands:read", "settings:read"],
}

beforeEach(() => vi.unstubAllGlobals())

describe("navigation by role (BR-025)", () => {
  it("ops sees no user-management, settings or audit navigation at all (P1-066)", async () => {
    mockApi(perms.ops, () => undefined, "ops")
    renderSignedIn(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )
    await screen.findByRole("link", { name: "Products" })
    for (const name of ["Team", "Settings", "Audit log"]) {
      expect(screen.queryByRole("link", { name })).toBeNull()
    }
  })

  it("owner sees team, settings and the audit log", async () => {
    mockApi(perms.owner, () => undefined, "owner")
    renderSignedIn(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )
    for (const name of ["Team", "Settings", "Audit log"]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument()
    }
  })

  it("viewer reads settings but manages no one", async () => {
    mockApi(perms.viewer, () => undefined, "viewer")
    renderSignedIn(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )
    expect(
      await screen.findByRole("link", { name: "Settings" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Team" })).toBeNull()
  })
})
