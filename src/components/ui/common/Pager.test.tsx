import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Pager } from "./Pager"

describe("Pager (P1-232)", () => {
  it("counts the rows shown and moves between pages", async () => {
    const onPage = vi.fn()
    render(
      <Pager page={2} limit={50} total={128} noun="orders" onPage={onPage} />,
    )

    expect(screen.getByText("51–100 of 128 orders")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    )

    await userEvent.click(screen.getByRole("button", { name: "Page 3" }))
    await userEvent.click(screen.getByRole("button", { name: "Previous" }))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(onPage.mock.calls).toEqual([[3], [1], [3]])
  })

  it("disables the ends and hides the buttons on a single page", () => {
    const { rerender } = render(
      <Pager page={1} limit={50} total={128} noun="orders" onPage={vi.fn()} />,
    )
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()

    rerender(
      <Pager page={3} limit={50} total={128} noun="orders" onPage={vi.fn()} />,
    )
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()

    rerender(
      <Pager page={1} limit={50} total={12} noun="orders" onPage={vi.fn()} />,
    )
    expect(screen.getByText("1–12 of 12 orders")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })

  it("renders nothing without a total", () => {
    const { container } = render(
      <Pager
        page={1}
        limit={50}
        total={undefined}
        noun="orders"
        onPage={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
