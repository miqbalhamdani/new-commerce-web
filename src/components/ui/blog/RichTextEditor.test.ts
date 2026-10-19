import { Editor } from "@tiptap/react"
import { describe, expect, it } from "vitest"

import { bodyExtensions } from "./RichTextEditor"

describe("the post body editor stores Markdown (P1-607, BR-135)", () => {
  it("reads Markdown in and writes the same Markdown out", () => {
    const md = [
      "## 1. Tentukan anggaran",
      "",
      "Seprai **katun** dan _TENCEL™_, baca [panduan ukuran](https://example.com/size).",
      "",
      "- Single",
      "- Queen",
      "",
      "1. Tentukan anggaran",
      "2. Ukur kasur",
      "",
      "> Ikuti tujuh langkah panduan.",
      "",
      "![Sprei putih](https://img.example/t/blogs/p1/abc.webp)",
    ].join("\n")
    const editor = new Editor({
      extensions: bodyExtensions,
      content: md,
      contentType: "markdown",
    })
    const out = editor.getMarkdown()
    editor.destroy()

    for (const part of [
      "## 1. Tentukan anggaran",
      "**katun**",
      "[panduan ukuran](https://example.com/size)",
      "- Single",
      "1. Tentukan anggaran",
      "> Ikuti tujuh langkah panduan.",
      "![Sprei putih](https://img.example/t/blogs/p1/abc.webp)",
    ])
      expect(out).toContain(part)
    expect(out).not.toContain("<")
  })
})
