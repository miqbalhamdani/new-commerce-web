import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { TagInput } from "./TagInput"

function Harness({ start = [] as string[] }) {
  const [tags, setTags] = useState(start)
  return (
    <>
      <TagInput id="tags" value={tags} onChange={setTags} />
      <output>{tags.join("|")}</output>
    </>
  )
}

describe("TagInput (P1-607)", () => {
  it("adds on Enter or comma, trimmed and never twice", async () => {
    render(<Harness />)
    const box = screen.getByRole("textbox")
    await userEvent.type(box, " Bedding Tips {Enter}")
    await userEvent.type(box, "Panduan,Bedding Tips,")
    expect(screen.getByRole("status")).toHaveTextContent("Bedding Tips|Panduan")
  })

  it("removes with × or Backspace in an empty box", async () => {
    render(<Harness start={["a", "b", "c"]} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove b" }))
    expect(screen.getByRole("status")).toHaveTextContent("a|c")
    await userEvent.type(screen.getByRole("textbox"), "{Backspace}")
    expect(screen.getByRole("status")).toHaveTextContent(/^a$/)
  })

  it("stops at ten", async () => {
    render(
      <Harness start={["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]} />,
    )
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})
