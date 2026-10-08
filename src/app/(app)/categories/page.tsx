"use client"

import { ChevronRight, GripVertical } from "lucide-react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { NativeSelect } from "@/components/ui/common/Field"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Category, CategoryDetail, CategoryKind } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import {
  buildTree,
  isSelfOrDescendant,
  moveMessage,
  type TreeNode,
} from "@/lib/catalog/tree"
import { cx } from "@/lib/utils"

// P1-032: one tree per kind, drag to move, a dialog that states what moves
// (04-api-spec.md §6.2; BR-031..BR-036).

const kinds: { value: CategoryKind; label: string }[] = [
  { value: "category", label: "Categories (main tree)" },
  { value: "series", label: "Series" },
  { value: "collection", label: "Collections" },
  { value: "activity", label: "Activities" },
  { value: "custom", label: "Custom" },
]

type Move = { node: Category; parent: Category | null }

export default function CategoriesPage() {
  const canWrite = useCan("categories:write")
  const [kind, setKind] = useState<CategoryKind>("category")
  const { data, error, loading, reload } = useResource<{ data: Category[] }>(
    `/v1/categories?kind=${kind}`,
  )
  const categories = data?.data ?? []
  const [move, setMove] = useState<Move | null>(null)
  const [dragging, setDragging] = useState<Category | null>(null)
  const [adding, setAdding] = useState<{ parent: Category | null } | null>(null)
  const [archiving, setArchiving] = useState<Category | null>(null)

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
      actions={
        canWrite && (
          <Button size="sm" onClick={() => setAdding({ parent: null })}>
            Add top-level
          </Button>
        )
      }
    >
      <div className="mb-4">
        <NativeSelect
          aria-label="Tree"
          value={kind}
          onChange={(e) => setKind(e.target.value as CategoryKind)}
        >
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ErrorNotice error={error} title="Could not load categories" />
      {loading && !data ? (
        <Loading />
      ) : categories.length === 0 ? (
        <Empty title="This tree is empty">
          {canWrite && "Add a top-level category to start it."}
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
                onAdd={(parent) => setAdding({ parent })}
                onArchive={setArchiving}
                onRenamed={reload}
              />
            ))}
          </ul>
        </Card>
      )}

      <MoveDialog move={move} onClose={() => setMove(null)} onDone={reload} />
      <AddDialog
        adding={adding}
        kind={kind}
        onClose={() => setAdding(null)}
        onDone={reload}
      />
      <ArchiveDialog
        category={archiving}
        onClose={() => setArchiving(null)}
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
  onArchive: (c: Category) => void
  onRenamed: () => void
}) {
  const { node, depth, canWrite, dragging, categories } = props
  const c = node.category
  const api = useApi()
  const [open, setOpen] = useState(true)
  const [over, setOver] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(c.name)
  const [error, setError] = useState<ApiError | null>(null)
  const forbidden =
    dragging !== null && isSelfOrDescendant(categories, dragging.id, c.id)

  async function rename() {
    try {
      await api(`/v1/categories/${c.id}`, { method: "PATCH", body: { name } })
      setRenaming(false)
      setError(null)
      props.onRenamed()
    } catch (err) {
      setError(asApiError(err))
    }
  }

  return (
    <li
      role="treeitem"
      aria-expanded={node.children.length ? open : undefined}
      aria-selected={false}
    >
      <div
        draggable={canWrite && !renaming}
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
          "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-theme-sm hover:bg-gray-100 dark:hover:bg-white/[0.03]",
          over && "bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/[0.12]",
          forbidden && "opacity-40",
        )}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setOpen(!open)}
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
        {renaming ? (
          <span className="flex items-center gap-2">
            <Input
              className="!h-9"
              aria-label={`Rename ${c.name}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename()
                if (e.key === "Escape") setRenaming(false)
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRenaming(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={rename}>
              Save
            </Button>
          </span>
        ) : (
          <span className="text-gray-800 dark:text-white/90">{c.name}</span>
        )}
        {canWrite && !renaming && (
          <span className="ml-auto hidden gap-1 group-focus-within:flex group-hover:flex">
            <Button
              size="sm"
              className="!py-1.5"
              variant="ghost"
              onClick={() => props.onAdd(c)}
            >
              Add child
            </Button>
            <Button
              size="sm"
              className="!py-1.5"
              variant="ghost"
              onClick={() => setRenaming(true)}
            >
              Rename
            </Button>
            <Button
              size="sm"
              className="!py-1.5"
              variant="ghost"
              onClick={() => props.onArchive(c)}
            >
              Archive
            </Button>
          </span>
        )}
      </div>
      {error && (
        <p className="ml-10 text-xs text-error-600 dark:text-error-400">
          {error.message}
        </p>
      )}
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

function AddDialog({
  adding,
  kind,
  onClose,
  onDone,
}: {
  adding: { parent: Category | null } | null
  kind: CategoryKind
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [name, setName] = useState("")
  const [error, setError] = useState<ApiError | null>(null)
  async function add(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api("/v1/categories", {
        method: "POST",
        body: {
          name,
          kind,
          ...(adding?.parent ? { parent_id: adding.parent.id } : {}),
        },
      })
      setName("")
      setError(null)
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    }
  }
  return (
    <Dialog
      open={adding !== null}
      onOpenChange={(o) => !o && onClose()}
      title={
        adding?.parent
          ? `Add under ${adding.parent.name}`
          : "Add a top-level category"
      }
    >
      <form onSubmit={add} className="flex flex-col gap-3">
        <Input
          aria-label="Name"
          placeholder="Name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <ErrorNotice error={error} />
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={!name.trim()}>
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** A category still in use cannot be archived; the 409 names both counts (BR-036). */
function ArchiveDialog({
  category,
  onClose,
  onDone,
}: {
  category: Category | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  async function archive() {
    if (!category) return
    try {
      await api(`/v1/categories/${category.id}`, { method: "DELETE" })
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    }
  }
  const counts =
    error?.code === "category_in_use"
      ? Object.fromEntries(
          (error.problem.errors ?? []).map((e) => [
            e.field,
            (e as { count?: number }).count ?? 0,
          ]),
        )
      : null
  return (
    <Dialog
      open={category !== null}
      onOpenChange={(o) => {
        if (!o) {
          setError(null)
          onClose()
        }
      }}
      title={`Archive ${category?.name ?? ""}?`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={archive}>
            Archive
          </Button>
        </>
      }
    >
      {counts ? (
        <p
          role="alert"
          className="text-theme-sm text-error-700 dark:text-error-400"
        >
          It still has {counts.children ?? 0} subcategories and{" "}
          {counts.products ?? 0} products. Move or archive those first.
        </p>
      ) : (
        <ErrorNotice error={error} />
      )}
    </Dialog>
  )
}
