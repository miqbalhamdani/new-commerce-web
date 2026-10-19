import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { DatePicker } from "./DatePicker"

function Harness() {
  const [date, setDate] = useState("2026-12-24")
  return (
    <>
      <DatePicker aria-label="Date" value={date} onChange={setDate} />
      <output>{date}</output>
    </>
  )
}

describe("DatePicker", () => {
  it("opens from a click in the box, on the chosen month, and picks a day", async () => {
    render(<Harness />)
    await userEvent.click(screen.getByLabelText("Date"))
    expect(screen.getByText("December 2026")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "2026-12-25" }))
    expect(screen.getByRole("status")).toHaveTextContent("2026-12-25")
    expect(screen.queryByText("December 2026")).toBeNull()
  })
})
