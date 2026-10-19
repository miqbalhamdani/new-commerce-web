"use client"

import Image from "@tiptap/extension-image"
import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
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

import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { Field } from "@/components/ui/common/Field"
import { imageTypes, maxImageBytes } from "@/lib/catalog/upload"
import { cx } from "@/lib/utils"

/** A body image's sizes: a percent of the column; null is the full column. */
const imageSizes = [
  { label: "Small", width: 33 },
  { label: "Medium", width: 50 },
  { label: "Large", width: 75 },
  { label: "Full", width: null },
] as const

const widthFragment = /#w=(\d{1,3})$/

/**
 * The body's image. Markdown has no attributes and the website renders no
 * raw HTML, so the width rides in the URL as #w=NN (BR-135); a renderer that
 * ignores it shows the image full width.
 */
const BodyImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-width")) || null,
        renderHTML: (attrs) =>
          attrs.width
            ? { "data-width": attrs.width, style: `width: ${attrs.width}%` }
            : {},
      },
    }
  },
  parseMarkdown: (token, helpers) => {
    const href = token.href ?? ""
    const m = widthFragment.exec(href)
    const w = m ? Number(m[1]) : 0
    const width = m && w >= 1 && w <= 100 ? w : null
    return helpers.createNode("image", {
      // An unknown fragment stays in the URL, untouched.
      src: m && width ? href.slice(0, m.index) : href,
      title: token.title,
      alt: token.text,
      width,
    })
  },
  renderMarkdown: (node) => {
    const { src, alt, title, width } = node.attrs ?? {}
    const url = width ? `${src ?? ""}#w=${width}` : (src ?? "")
    return title
      ? `![${alt ?? ""}](${url} "${title}")`
      : `![${alt ?? ""}](${url})`
  },
})

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
  BodyImage.configure({ allowBase64: false }),
  Markdown,
]

const imagesIn = (files: FileList | null | undefined) =>
  [...(files ?? [])].filter((f) => f.type.startsWith("image/"))

/**
 * A rich text field over a Markdown value (P1-607). onChange fires on edits
 * only, never on load, so an untouched post is not dirty. Images come from
 * the Image button, a drop or a paste; each opens ImageAltDialog for its alt
 * text, then uploadImage stores it and gives back its URL. Without uploadImage
 * (a post not saved yet) images are refused with a note. A selected image
 * shows a size bar: Small, Medium, Large, Full.
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
  // The images waiting for their alt text, one dialog each, and where they go.
  const [queue, setQueue] = useState<{
    files: File[]
    at: number
    total: number
  } | null>(null)
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
            imageWidth: e.isActive("image")
              ? ((e.getAttributes("image").width as number | null) ?? null)
              : undefined,
          }
        : null,
  })

  function addImages(files: File[], at?: number) {
    if (!editor) return
    if (!uploadImage) {
      setImageError("Save the post first to add images.")
      return
    }
    // Refuse what the store would refuse before asking anything.
    const ok = files.filter(
      (f) => imageTypes.includes(f.type) && f.size <= maxImageBytes,
    )
    setImageError(
      ok.length < files.length
        ? "Images are JPEG, PNG or WebP up to 20 MB; the others were left out."
        : null,
    )
    if (ok.length)
      setQueue({
        files: ok,
        at: at ?? editor.state.selection.to,
        total: ok.length,
      })
  }
  const nextImage = (at: number) =>
    setQueue((q) =>
      q && q.files.length > 1 ? { ...q, files: q.files.slice(1), at } : null,
    )
  async function insertImage(alt: string) {
    if (!editor || !uploadImage || !queue) return
    const src = await uploadImage(queue.files[0])
    editor
      .chain()
      .focus()
      .insertContentAt(Math.min(queue.at, editor.state.doc.content.size), {
        type: "image",
        attrs: { src, alt: alt.trim() },
      })
      .run()
    nextImage(editor.state.selection.to)
  }
  useEffect(() => {
    add.current = addImages
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
          disabled: !uploadImage || queue !== null,
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
            <input
              ref={fileInput}
              type="file"
              accept={imageTypes.join(",")}
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = "" // the same file can be picked again
                addImages(files)
              }}
            />
          </div>
        )}
        {editor && !disabled && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: e }) => e.isEditable && e.isActive("image")}
            role="group"
            aria-label="Image size"
            className="flex gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-theme-md dark:border-gray-800 dark:bg-gray-dark"
          >
            {imageSizes.map((size) => (
              <button
                key={size.label}
                type="button"
                aria-pressed={active?.imageWidth === size.width}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("image", { width: size.width })
                    .run()
                }
                className={cx(
                  "rounded-md px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
                  active?.imageWidth === size.width &&
                    "bg-brand-50 text-brand-600 hover:bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400",
                )}
              >
                {size.label}
              </button>
            ))}
          </BubbleMenu>
        )}
        <EditorContent
          editor={editor}
          className="text-sm text-gray-800 dark:text-white/90"
        />
      </div>
      {imageError && (
        <p className="mt-1.5 text-xs text-error-500">{imageError}</p>
      )}
      {queue && (
        <ImageAltDialog
          key={queue.total - queue.files.length}
          file={queue.files[0]}
          note={
            queue.total > 1
              ? `Image ${queue.total - queue.files.length + 1} of ${queue.total}`
              : undefined
          }
          onAdd={insertImage}
          onSkip={() => nextImage(queue.at)}
        />
      )}
    </div>
  )
}

/**
 * Asks for one image's alt text, showing the image (P1-607). The field
 * starts empty: a file name is rarely a description. onAdd uploads and
 * inserts; the dialog waits on it, so an error can be retried here.
 */
export function ImageAltDialog({
  file,
  note,
  onAdd,
  onSkip,
}: {
  file: File
  note?: string
  onAdd: (alt: string) => Promise<void>
  onSkip: () => void
}) {
  const [preview] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(preview), [preview])
  const [alt, setAlt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The Dialog focuses its title once open; the field takes it after.
  useEffect(() => {
    const t = setTimeout(() => document.getElementById("image-alt")?.focus())
    return () => clearTimeout(t)
  }, [])

  async function add() {
    setBusy(true)
    setError(null)
    try {
      await onAdd(alt)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The image could not be uploaded.",
      )
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onSkip()}
      dismissible={!busy}
      title="Add an image"
      description={note}
      footer={
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={onSkip}>
            Cancel
          </Button>
          <Button size="sm" isLoading={busy} onClick={() => void add()}>
            Add image
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
          <img
            src={preview}
            alt=""
            className="max-h-64 w-full rounded-xl bg-gray-50 object-contain dark:bg-white/[0.03]"
          />
          <figcaption className="mt-1.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {file.name}
          </figcaption>
        </figure>
        <Field
          id="image-alt"
          label="Alt text"
          hint="Describe what the image shows. Screen readers read it aloud and search engines use it."
        >
          <Input
            id="image-alt"
            value={alt}
            placeholder="e.g. White cotton sheets on a made bed"
            disabled={busy}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              // Not a <form>: the dialog sits inside the post's form.
              if (e.key !== "Enter") return
              e.preventDefault()
              if (!busy) void add()
            }}
          />
        </Field>
        {error && <p className="text-xs text-error-500">{error}</p>}
      </div>
    </Dialog>
  )
}
