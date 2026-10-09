import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Select } from "./Select"

const options = [
  { value: "", label: "All brands" },
  { value: "b1", label: "Acme" },
  { value: "b2", label: "Globex" },
]

describe("Select", () => {
  it("opens on click and reports the picked value", async () => {
    const onChange = vi.fn()
    render(
      <Select aria-label="Brand" value="" onChange={onChange} options={options} />,
    )
    const trigger = screen.getByRole("button", { name: "Brand" })
    expect(trigger).toHaveTextContent("All brands")
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("option", { name: "Acme" }))
    expect(onChange).toHaveBeenCalledWith("b1")
  })

  it("marks the current value as selected in the list", async () => {
    render(
      <Select aria-label="Brand" value="b2" onChange={() => {}} options={options} />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Brand" }))
    expect(await screen.findByRole("option", { name: "Globex" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByRole("option", { name: "Acme" })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  it("wires the error state to the field's message id", () => {
    render(
      <Select id="brand" value="" onChange={() => {}} options={options} error />,
    )
    const trigger = screen.getByRole("button")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-describedby", "brand-error")
  })

  it("is disabled by a surrounding disabled fieldset", () => {
    render(
      <fieldset disabled>
        <Select aria-label="Brand" value="" onChange={() => {}} options={options} />
      </fieldset>,
    )
    expect(screen.getByRole("button", { name: "Brand" })).toBeDisabled()
  })
})
