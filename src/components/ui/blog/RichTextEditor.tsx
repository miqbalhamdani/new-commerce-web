"use client"

import Image from "@tiptap/extension-image"
import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { imageTypes } from "@/lib/catalog/upload"
import { cx } from "@/lib/utils"

/**
 * The extensions a post body uses, shared with the round-trip test. Markdown
 * is what is stored (BR-135): the editor reads it in and writes it out, so the
 * API, the excerpt and the website never see HTML. No underline: Markdown has
 * none. Images are ![alt](url), never inline data.
 */
export const bodyExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    underline: false,
    link: { openOnClick: false, autolink: true },
  }),
  Image.configure({ allowBase64: false }),
  Markdown,
]

const imagesIn = (files: FileList | null | undefined) =>
  [...(files ?? [])].filter((f) => f.type.startsWith("image/"))

/**
 * A rich text field over a Markdown value (P1-607). onChange fires on edits
 * only, never on load, so an untouched post is not dirty. Images come from
 * the Image button, a drop or a paste; each asks for its alt text, then
 * uploadImage stores it and gives back its URL. Without uploadImage (a post
 * not saved yet) images are refused with a note.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  disabled,
  uploadImage,
}: {
  id: string
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
  uploadImage?: (file: File) => Promise<string>
}) {
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // The editor's drop and paste handlers are made once; they reach the
  // current addImages through this.
  const add = useRef<(files: File[], at?: number) => void>(() => {})

  const editor = useEditor({
    extensions: bodyExtensions,
    content: value,
    contentType: "markdown",
    editable: !disabled,
    immediatelyRender: false, // the page renders on the server first
    editorProps: {
      attributes: {
        id,
        "aria-multiline": "true",
        role: "textbox",
        class: "post-body min-h-80 px-4 py-3 focus:outline-none",
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imagesIn(event.dataTransfer?.files)
        if (moved || files.length === 0) return false
        event.preventDefault()
        add.current(
          files,
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos,
        )
        return true
      },
      handlePaste: (_view, event) => {
        const files = imagesIn(event.clipboardData?.files)
        if (files.length === 0) return false
        add.current(files)
        return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  })
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  })

  async function addImages(files: File[], at?: number) {
    if (!editor) return
    if (!uploadImage) {
      setImageError("Save the post first to add images.")
      return
    }
    setImageError(null)
    let pos = at ?? editor.state.selection.to
    for (const file of files) {
      const alt = window.prompt(
        "Describe the image for people who can't see it",
        file.name.replace(/\.[^.]+$/, ""),
      )
      if (alt === null) continue
      setUploading(true)
      try {
        const src = await uploadImage(file)
        editor
          .chain()
          .focus()
          .insertContentAt(Math.min(pos, editor.state.doc.content.size), {
            type: "image",
            attrs: { src, alt: alt.trim() },
          })
          .run()
        pos = editor.state.selection.to
      } catch (e) {
        setImageError(
          e instanceof Error ? e.message : "The image could not be uploaded.",
        )
      } finally {
        setUploading(false)
      }
    }
  }
  useEffect(() => {
    add.current = (files, at) => void addImages(files, at)
  })

  function link() {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const href = window.prompt("Link to", prev ?? "https://")
    if (href === null) return
    const chain = editor.chain().focus().extendMarkRange("link")
    if (href.trim() === "") chain.unsetLink().run()
    else chain.setLink({ href: href.trim() }).run()
  }

  const tools: {
    label: string
    icon: LucideIcon
    on?: boolean
    run: () => void
    disabled?: boolean
    title?: string
  }[] = editor
    ? [
        {
          label: "Bold",
          icon: Bold,
          on: active?.bold,
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "Italic",
          icon: Italic,
          on: active?.italic,
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: "Heading",
          icon: Heading2,
          on: active?.h2,
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "Subheading",
          icon: Heading3,
          on: active?.h3,
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: "Bulleted list",
          icon: List,
          on: active?.bullet,
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "Numbered list",
          icon: ListOrdered,
          on: active?.ordered,
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        { label: "Link", icon: Link2, on: active?.link, run: link },
        // The boxed Kesimpulan on the website is a blockquote (BR-135).
        {
          label: "Box",
          icon: Quote,
          on: active?.quote,
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: "Image",
          icon: ImagePlus,
          on: false,
          run: () => fileInput.current?.click(),
          disabled: !uploadImage || uploading,
          title: uploadImage ? "Image" : "Save the post first to add images",
        },
        {
          label: "Undo",
          icon: Undo2,
          on: false,
          run: () => editor.chain().focus().undo().run(),
        },
        {
          label: "Redo",
          icon: Redo2,
          on: false,
          run: () => editor.chain().focus().redo().run(),
        },
      ]
    : []

  return (
    <div>
      <div
        className={cx(
          "overflow-hidden rounded-lg border border-gray-300 shadow-theme-xs focus-within:border-brand-300 focus-within:ring focus-within:ring-brand-500/10",
          "dark:border-gray-700 dark:focus-within:border-brand-800",
          disabled && "opacity-60",
        )}
      >
        {!disabled && (
          <div
            role="toolbar"
            aria-label="Formatting"
            className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            {tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.title ?? t.label}
                aria-label={t.label}
                aria-pressed={t.on || undefined}
                disabled={t.disabled}
                onClick={t.run}
                className={cx(
                  "flex size-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-white/10",
                  t.on &&
                    "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
                )}
              >
                <t.icon className="size-4" aria-hidden />
              </button>
            ))}
            {uploading && (
              <span
                role="status"
                className="ml-auto self-center px-2 text-theme-xs text-gray-500 dark:text-gray-400"
              >
                Uploading image…
              </span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={imageTypes.join(",")}
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = "" // the same file can be picked again
                void addImages(files)
              }}
            />
          </div>
        )}
        <EditorContent
          editor={editor}
          className="text-sm text-gray-800 dark:text-white/90"
        />
      </div>
      {imageError && (
        <p className="mt-1.5 text-xs text-error-500">{imageError}</p>
      )}
    </div>
  )
}
