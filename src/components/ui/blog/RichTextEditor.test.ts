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

describe("a body image's size rides in its URL as #w= (P1-607, BR-135)", () => {
  const open = (md: string) =>
    new Editor({
      extensions: bodyExtensions,
      content: md,
      contentType: "markdown",
    })
  const firstImage = (editor: Editor) => {
    let pos = -1
    editor.state.doc.descendants((n, p) => {
      if (pos < 0 && n.type.name === "image") pos = p
    })
    return pos
  }

  it("reads #w=50 as half the column and writes it back", () => {
    const editor = open("![Sprei](https://img.example/a.webp#w=50)")
    const node = editor.state.doc.nodeAt(firstImage(editor))
    expect(node?.attrs).toMatchObject({
      src: "https://img.example/a.webp",
      width: 50,
    })
    expect(editor.getHTML()).toContain('data-width="50"')
    expect(editor.getHTML()).toContain("width: 50%")
    expect(editor.getMarkdown()).toContain(
      "![Sprei](https://img.example/a.webp#w=50)",
    )
    editor.destroy()
  })

  it("a size picked writes the fragment; Full drops it", () => {
    const editor = open("![Sprei](https://img.example/a.webp)")
    editor
      .chain()
      .setNodeSelection(firstImage(editor))
      .updateAttributes("image", { width: 75 })
      .run()
    expect(editor.getMarkdown()).toContain("a.webp#w=75)")
    editor.chain().updateAttributes("image", { width: null }).run()
    expect(editor.getMarkdown()).toContain("(https://img.example/a.webp)")
    editor.destroy()
  })

  it("leaves an unknown fragment alone, at full width", () => {
    const editor = open("![Sprei](https://img.example/a.webp#w=500)")
    expect(editor.state.doc.nodeAt(firstImage(editor))?.attrs.width).toBeNull()
    expect(editor.getMarkdown()).toContain("a.webp#w=500)")
    editor.destroy()
  })
})
