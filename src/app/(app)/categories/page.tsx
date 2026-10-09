"use client"

import { ChevronRight, GripVertical } from "lucide-react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Checkbox, Field } from "@/components/ui/common/Field"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { RowMenu } from "@/components/ui/common/RowMenu"
import { Select } from "@/components/ui/common/Select"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons"
import { ApiError } from "@/lib/api/client"
import type { Category, CategoryDetail, CategoryKind } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { pathLabel } from "@/lib/catalog/slug"
import {
  buildTree,
  inTreeOrder,
  isSelfOrDescendant,
  moveMessage,
  type TreeNode,
} from "@/lib/catalog/tree"
import { cx } from "@/lib/utils"

// P1-032: one tree per kind, drag to move, a dialog that states what moves
// (04-api-spec.md §6.2; BR-031..BR-036). Add and edit share one modal; a
// category's own path segment (label) is editable like a brand's slug.

const kinds: { value: CategoryKind; label: string }[] = [
  { value: "category", label: "Categories" },
  { value: "series", label: "Series" },
  { value: "collection", label: "Collections" },
  { value: "activity", label: "Activities" },
  { value: "custom", label: "Custom" },
]

type Move = { node: Category; parent: Category | null }

/** The modal: a category to edit, or a new one under parentId (null: top level). */
type Editing = { category: Category } | { parentId: string | null } | null

export default function CategoriesPage() {
  const canWrite = useCan("categories:write")
  const [kind, setKind] = useState<CategoryKind>("category")
  const { data, error, loading, reload } = useResource<{ data: Category[] }>(
    `/v1/categories?kind=${kind}`,
  )
  const categories = data?.data ?? []
  const [move, setMove] = useState<Move | null>(null)
  const [dragging, setDragging] = useState<Category | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  function dropOn(parent: Category | null) {
    if (!dragging) return
    const target = parent?.id ?? null
    if (target === dragging.parent_id) return
    if (parent && isSelfOrDescendant(categories, dragging.id, parent.id)) return // BR-034
    setMove({ node: dragging, parent })
    setDragging(null)
  }

  return (
    <Page
      title="Categories"
      description="Independent trees: one product can sit in a category, a series and a collection at once."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Tree"
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
        >
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cx(
                "whitespace-nowrap rounded-md px-3 py-2 text-theme-sm font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
                kind === k.value
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setEditing({ parentId: null })}>
            Add category
          </Button>
        )}
      </div>
      <ErrorNotice error={error} title="Could not load categories" />
      {loading && !data ? (
        <Loading />
      ) : categories.length === 0 ? (
        <Empty title="This tree is empty">
          {canWrite && "Use Add category to start it."}
        </Empty>
      ) : (
        <Card className="p-2">
          {canWrite && dragging && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(null)}
              className="mb-2 rounded-lg border border-dashed border-brand-500 p-2 text-center text-theme-xs text-brand-500 dark:text-brand-400"
            >
              Drop here to make it top-level
            </div>
          )}
          <ul role="tree" aria-label="Categories">
            {buildTree(categories).map((n) => (
              <Node
                key={n.category.id}
                node={n}
                depth={0}
                canWrite={canWrite}
                dragging={dragging}
                categories={categories}
                onDragStart={setDragging}
                onDragEnd={() => setDragging(null)}
                onDrop={dropOn}
                onAdd={(parent) => setEditing({ parentId: parent.id })}
                onEdit={(category) => setEditing({ category })}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        </Card>
      )}

      <MoveDialog move={move} onClose={() => setMove(null)} onDone={reload} />
      {editing && (
        <CategoryDialog
          key={
            "category" in editing
              ? editing.category.id
              : `new:${editing.parentId}`
          }
          editing={editing}
          kind={kind}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={reload}
        />
      )}
      <DeleteDialog
        category={deleting}
        onClose={() => setDeleting(null)}
        onDone={reload}
      />
    </Page>
  )
}

function Node(props: {
  node: TreeNode
  depth: number
  canWrite: boolean
  dragging: Category | null
  categories: Category[]
  onDragStart: (c: Category) => void
  onDragEnd: () => void
  onDrop: (parent: Category) => void
  onAdd: (parent: Category) => void
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  const { node, depth, canWrite, dragging, categories } = props
  const c = node.category
  const [open, setOpen] = useState(true)
  const [over, setOver] = useState(false)
  const forbidden =
    dragging !== null && isSelfOrDescendant(categories, dragging.id, c.id)

  return (
    <li
      role="treeitem"
      aria-expanded={node.children.length ? open : undefined}
      aria-selected={false}
    >
      {/* The row opens Edit for the mouse; the menu's Edit is the keyboard path. */}
      <div
        draggable={canWrite}
        onClick={canWrite ? () => props.onEdit(c) : undefined}
        onDragStart={() => props.onDragStart(c)}
        onDragEnd={props.onDragEnd}
        onDragOver={(e) => {
          if (canWrite && !forbidden) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={() => {
          setOver(false)
          props.onDrop(c)
        }}
        className={cx(
          "flex items-center gap-1 rounded-lg px-2 py-1 text-theme-sm hover:bg-gray-100 dark:hover:bg-white/[0.03]",
          canWrite && "cursor-pointer",
          over && "bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/[0.12]",
          forbidden && "opacity-40",
        )}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(!open)
            }}
          >
            <ChevronRight
              className={cx(
                "size-4 text-gray-400 transition",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-4" />
        )}
        {canWrite && (
          <GripVertical
            aria-hidden
            className="size-4 cursor-grab text-gray-300"
          />
        )}
        <span className="text-gray-800 dark:text-white/90">{c.name}</span>
        <span className="ml-2 truncate text-theme-xs text-gray-400 dark:text-gray-500">
          {c.path}
        </span>
        {canWrite ? (
          <span className="ml-auto">
            <RowMenu
              label={`Actions for ${c.name}`}
              actions={[
                {
                  label: "Add subcategory",
                  icon: <PlusIcon />,
                  onSelect: () => props.onAdd(c),
                },
                {
                  label: "Edit",
                  icon: <PencilIcon />,
                  onSelect: () => props.onEdit(c),
                },
                {
                  label: "Delete",
                  icon: <TrashBinIcon />,
                  destructive: true,
                  onSelect: () => props.onDelete(c),
                },
              ]}
            />
          </span>
        ) : (
          <span className="h-8" />
        )}
      </div>
      {open && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((child) => (
            <Node
              key={child.category.id}
              {...props}
              node={child}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * The move confirmation states what moves and what does not (BR-033):
 * "Move Jackets and its 4 subcategories? 128 products keep their assignments."
 */
function MoveDialog({
  move,
  onClose,
  onDone,
}: {
  move: Move | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const { data: detail } = useResource<CategoryDetail>(
    move ? `/v1/categories/${move.node.id}` : null,
  )
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const n = detail?.descendant_count ?? 0
  const p = detail?.product_count ?? 0

  async function confirm() {
    if (!move) return
    setBusy(true)
    try {
      await api(`/v1/categories/${move.node.id}`, {
        method: "PATCH",
        body: { parent_id: move.parent?.id ?? null },
      })
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={move !== null}
      onOpenChange={(o) => !o && onClose()}
      title={
        move
          ? moveMessage(move.node.name, move.parent?.name ?? null, n, p).title
          : ""
      }
      description={detail ? moveMessage("", null, n, p).detail : "Counting…"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            isLoading={busy}
            disabled={!detail}
            onClick={confirm}
          >
            Move
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}

/**
 * Add (top level or under a parent) or edit. The path segment follows the
 * name until "Edit path" is ticked; then it is sent as typed (BR-032).
 * Unticking it on edit sends label: null, back to the derived segment.
 * Changing the parent is a move, like a drag, so products keep their
 * assignments (BR-033).
 */
function CategoryDialog({
  editing,
  kind,
  categories,
  onClose,
  onDone,
}: {
  editing: NonNullable<Editing>
  kind: CategoryKind
  categories: Category[]
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const category = "category" in editing ? editing.category : null
  const initialParent = category
    ? category.parent_id
    : (editing as { parentId: string | null }).parentId
  const [name, setName] = useState(category?.name ?? "")
  const [parentId, setParentId] = useState(initialParent ?? "")
  const [customLabel, setCustomLabel] = useState(category?.label != null)
  const [label, setLabel] = useState(category?.label ?? "")
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  // An already-derived segment with the name unchanged: show the one in use,
  // _1 suffix included.
  const derived =
    category && category.label === null && name === category.name
      ? category.path.split(".").pop()!
      : pathLabel(name)
  const shownLabel = customLabel ? label : derived
  const parent = categories.find((c) => c.id === parentId)
  const moved = category !== null && (parentId || null) !== category.parent_id

  const parentOptions = [
    { value: "", label: "None (top level)" },
    ...inTreeOrder(categories).map(({ category: c, depth }) => ({
      value: c.id,
      label: c.name,
      depth,
      disabled:
        category !== null && isSelfOrDescendant(categories, category.id, c.id),
    })),
  ]

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (category) {
        const body: Record<string, unknown> = {}
        if (name !== category.name) body.name = name
        if (moved) body.parent_id = parentId || null
        if (customLabel && label !== category.label) body.label = label
        if (!customLabel && category.label !== null) body.label = null
        await api(`/v1/categories/${category.id}`, { method: "PATCH", body })
      } else {
        await api("/v1/categories", {
          method: "POST",
          body: {
            name,
            kind,
            ...(parentId ? { parent_id: parentId } : {}),
            ...(customLabel ? { label } : {}),
          },
        })
      }
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const nameError = fieldError(error, "name")
  const labelError = fieldError(error, "label")
  const parentError = fieldError(error, "parent_id")
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? `Edit ${category.name}` : "Add a category"}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field id="category-name" label="Name" error={nameError}>
          <Input
            id="category-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            error={Boolean(nameError)}
          />
        </Field>
        <Field
          id="category-path"
          label="Path"
          error={labelError}
          hint={`Full path: ${parent ? `${parent.path}.` : ""}${shownLabel || "…"}`}
        >
          <Input
            id="category-path"
            value={shownLabel}
            readOnly={!customLabel}
            className={customLabel ? "" : "!bg-gray-50 dark:!bg-white/[0.03]"}
            onChange={(e) => setLabel(e.target.value)}
            error={Boolean(labelError)}
          />
        </Field>
        <label className="-mt-1 flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-400">
          <Checkbox
            checked={customLabel}
            onChange={(e) => {
              // Start editing from what was shown, not a stale value.
              if (e.target.checked) setLabel(shownLabel)
              setCustomLabel(e.target.checked)
            }}
          />
          Edit path
        </label>
        <Field
          id="category-parent"
          label="Parent"
          error={parentError}
          hint={
            moved
              ? "Its subcategories move with it; products keep their assignments."
              : undefined
          }
        >
          <Select
            id="category-parent"
            className="w-full"
            value={parentId}
            onChange={setParentId}
            options={parentOptions}
            error={Boolean(parentError)}
          />
        </Field>
        {error && !nameError && !labelError && !parentError && (
          <ErrorNotice error={error} />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            isLoading={saving}
            disabled={!name.trim() || (customLabel && !label.trim())}
          >
            {category ? "Save" : "Add category"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Deleting is blocked only by subcategories (BR-036); products just lose the
 * category (BR-012). The counts come from the detail the move dialog uses.
 */
function DeleteDialog({
  category,
  onClose,
  onDone,
}: {
  category: Category | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const { data: detail } = useResource<CategoryDetail>(
    category ? `/v1/categories/${category.id}` : null,
  )
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const children = detail?.descendant_count ?? 0
  const products = detail?.product_count ?? 0

  function close() {
    setError(null)
    onClose()
  }
  async function remove() {
    if (!category) return
    setBusy(true)
    try {
      await api(`/v1/categories/${category.id}`, { method: "DELETE" })
      close()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const blocked = children > 0 || error?.code === "category_in_use"
  return (
    <Dialog
      open={category !== null}
      onOpenChange={(o) => !o && close()}
      title={
        blocked
          ? `${category?.name ?? ""} can't be deleted yet`
          : `Delete ${category?.name ?? ""}?`
      }
      description={
        !detail
          ? "Counting…"
          : blocked
            ? `It has ${children} ${children === 1 ? "subcategory" : "subcategories"}. Move or delete ${children === 1 ? "it" : "them"} first.`
            : `${products === 0 ? "No products use it" : `${products} ${products === 1 ? "product" : "products"} will lose this category`}. This can't be undone.`
      }
      footer={
        <>
          <Button size="sm" variant="outline" onClick={close}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          {!blocked && (
            <Button
              size="sm"
              variant="destructive"
              isLoading={busy}
              disabled={!detail}
              onClick={remove}
            >
              Delete
            </Button>
          )}
        </>
      }
    >
      {!blocked && error && <ErrorNotice error={error} />}
    </Dialog>
  )
}
