"use client"

import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"

import { cx } from "@/lib/utils"

/**
 * The extensions a post body uses, shared with the round-trip test. Markdown
 * is what is stored (BR-135): the editor reads it in and writes it out, so the
 * API, the excerpt and the website never see HTML. No underline: Markdown has
 * none.
 */
export const bodyExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    underline: false,
    link: { openOnClick: false, autolink: true },
  }),
  Markdown,
]

/**
 * A rich text field over a Markdown value (P1-607). onChange fires on edits
 * only, never on load, so an untouched post is not dirty.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
}) {
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

  function link() {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const href = window.prompt("Link to", prev ?? "https://")
    if (href === null) return
    const chain = editor.chain().focus().extendMarkRange("link")
    if (href.trim() === "") chain.unsetLink().run()
    else chain.setLink({ href: href.trim() }).run()
  }

  const tools = editor
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
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.on || undefined}
              onClick={t.run}
              className={cx(
                "flex size-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/10",
                t.on &&
                  "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
              )}
            >
              <t.icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      )}
      <EditorContent
        editor={editor}
        className="text-sm text-gray-800 dark:text-white/90"
      />
    </div>
  )
}
