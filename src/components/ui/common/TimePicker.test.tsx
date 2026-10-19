import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { TimePicker } from "./TimePicker"

function Harness({ start = "" }) {
  const [time, setTime] = useState(start)
  return (
    <>
      <TimePicker aria-label="Time" value={time} onChange={setTime} />
      <output>{time}</output>
    </>
  )
}

describe("TimePicker (P1-607)", () => {
  it("picks an hour, then a minute that closes the panel", async () => {
    render(<Harness />)
    await userEvent.click(
      screen.getByRole("button", { name: "Open time picker" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Hour 09" }))
    expect(screen.getByRole("status")).toHaveTextContent("09:00")
    expect(screen.getByRole("button", { name: "Hour 09" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await userEvent.click(screen.getByRole("button", { name: "Minute 30" }))
    expect(screen.getByRole("status")).toHaveTextContent("09:30")
    expect(screen.queryByRole("button", { name: "Hour 09" })).toBeNull()
  })

  it("takes a typed time only when it is a real one", async () => {
    render(<Harness start="08:00" />)
    const box = screen.getByLabelText("Time")
    await userEvent.clear(box)
    await userEvent.type(box, "25:00")
    expect(screen.getByRole("status")).toHaveTextContent("")
    await userEvent.clear(box)
    await userEvent.type(box, "14:05")
    expect(screen.getByRole("status")).toHaveTextContent("14:05")
  })

  it("clears", async () => {
    render(<Harness start="10:15" />)
    await userEvent.click(
      screen.getByRole("button", { name: "Open time picker" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })
})
