import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImageAltDialog } from "./RichTextEditor"

// jsdom has no object URLs.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
})

const file = new File([new Uint8Array([1])], "1753966346695.jpg", {
  type: "image/jpeg",
})

describe("ImageAltDialog (P1-607)", () => {
  it("shows the image and an empty alt field with a placeholder, not the file name", () => {
    render(<ImageAltDialog file={file} onAdd={vi.fn()} onSkip={vi.fn()} />)
    expect(
      screen.getByRole("heading", { name: "Add an image" }),
    ).toBeInTheDocument()
    expect(document.querySelector("img")).toHaveAttribute("src", "blob:preview")
    expect(screen.getByText("1753966346695.jpg")).toBeInTheDocument()
    const alt = screen.getByLabelText("Alt text")
    expect(alt).toHaveValue("")
    expect(alt).toHaveAttribute(
      "placeholder",
      "e.g. White cotton sheets on a made bed",
    )
  })

  it("Add image hands over the alt text", async () => {
    const onAdd = vi.fn(async () => undefined)
    const onSkip = vi.fn()
    render(<ImageAltDialog file={file} onAdd={onAdd} onSkip={onSkip} />)
    await userEvent.type(screen.getByLabelText("Alt text"), "Sprei putih")
    await userEvent.click(screen.getByRole("button", { name: "Add image" }))
    expect(onAdd).toHaveBeenCalledWith("Sprei putih")
    // Busy until the editor moves on to the next image.
    expect(screen.getByLabelText("Alt text")).toBeDisabled()
  })

  it("Enter adds, as the button does; Cancel skips", async () => {
    const onAdd = vi.fn(async () => undefined)
    const onSkip = vi.fn()
    const { unmount } = render(
      <ImageAltDialog file={file} onAdd={onAdd} onSkip={onSkip} />,
    )
    await userEvent.type(screen.getByLabelText("Alt text"), "Sprei{Enter}")
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Sprei"))
    unmount()
    render(<ImageAltDialog file={file} onAdd={onAdd} onSkip={onSkip} />)
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it("keeps the dialog open with the error when the upload fails", async () => {
    const onAdd = vi.fn(async () => {
      throw new Error("1753966346695.jpg is over 20 MB.")
    })
    render(<ImageAltDialog file={file} onAdd={onAdd} onSkip={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Add image" }))
    expect(
      await screen.findByText("1753966346695.jpg is over 20 MB."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add image" })).toBeEnabled()
  })
})
