"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import Badge from "@/components/ui/badge/Badge"
import Button from "@/components/ui/button/Button"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { RowMenu } from "@/components/ui/common/RowMenu"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { Select } from "@/components/ui/common/Select"
import { PencilIcon, TrashBinIcon } from "@/icons"
import { ApiError } from "@/lib/api/client"
import type { BlogPostListItem, BlogPostPage } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { postState } from "@/lib/blog/post-form"
import { formatDate } from "@/lib/format"

// P1-607: blog posts (04-api-spec.md §13.2). Newest first; deleting archives
// (BR-012), and deleted posts are not listed.

const stateBadge = {
  draft: { label: "Draft", color: "light" },
  scheduled: { label: "Scheduled", color: "warning" },
  published: { label: "Published", color: "success" },
} as const

export default function BlogPostsPage() {
  const router = useRouter()
  const { tenant } = useSession()
  const canWrite = useCan("blog:write")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [cursor, setCursor] = useState<string | null>(null)
  const params = new URLSearchParams({ limit: "50" })
  if (q.trim()) params.set("q", q.trim())
  if (status) params.set("status", status)
  if (cursor) params.set("cursor", cursor)
  const { data, error, loading, reload } = useResource<BlogPostPage>(
    `/v1/blog/posts?${params}`,
  )
  const [deleting, setDeleting] = useState<BlogPostListItem | null>(null)

  return (
    <Page
      title="Posts"
      description="Your journal. Your website lists published posts, newest first."
    >
      {/* One row, as on Products: search, status, then New post at the end. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          aria-label="Search posts"
          placeholder="Search posts"
          className="w-full max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(null)
          }}
        />
        <Select
          aria-label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v)
            setCursor(null)
          }}
          options={[
            { value: "", label: "Any status" },
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published or scheduled" },
          ]}
        />
        {canWrite && (
          <Link href="/blog/new" className="ml-auto">
            <Button size="sm">New post</Button>
          </Link>
        )}
      </div>

      <ErrorNotice error={error} title="Could not load posts" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No posts yet">
          {canWrite && "Use New post to write the first one."}
        </Empty>
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={th}>
                Title
              </TableCell>
              <TableCell isHeader className={th}>
                Status
              </TableCell>
              <TableCell isHeader className={th}>
                Category
              </TableCell>
              <TableCell isHeader className={th}>
                Author
              </TableCell>
              <TableCell isHeader className={th}>
                Date
              </TableCell>
              {canWrite && (
                <TableCell isHeader className={`${th} w-px`}>
                  <span className="sr-only">Actions</span>
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((p) => {
              const look = stateBadge[postState(p)]
              return (
                <TableRow
                  key={p.id}
                  onClick={() => router.push(`/blog/${p.id}`)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <TableCell className={td}>
                    <Link
                      href={`/blog/${p.id}`}
                      className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.title}
                    </Link>
                    {p.is_featured && (
                      <span className="ml-2">
                        <Badge size="sm" color="primary">
                          Featured
                        </Badge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={td}>
                    <Badge size="sm" color={look.color}>
                      {look.label}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`${td} text-gray-500 dark:text-gray-400`}
                  >
                    {p.category?.name ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`${td} text-gray-500 dark:text-gray-400`}
                  >
                    {p.author?.name ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`${td} text-gray-500 dark:text-gray-400`}
                  >
                    {formatDate(p.published_at, tenant?.timezone)}
                  </TableCell>
                  {canWrite && (
                    <TableCell className={`${td} !py-2 text-right`}>
                      <RowMenu
                        label={`Actions for ${p.title}`}
                        actions={[
                          {
                            label: "Edit",
                            icon: <PencilIcon />,
                            onSelect: () => router.push(`/blog/${p.id}`),
                          },
                          {
                            label: "Delete",
                            icon: <TrashBinIcon />,
                            destructive: true,
                            onSelect: () => setDeleting(p),
                          },
                        ]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </ListTable>
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(data.next_cursor)}
          >
            Next page
          </Button>
        </div>
      )}

      <DeleteDialog
        post={deleting}
        onClose={() => setDeleting(null)}
        onDone={reload}
      />
    </Page>
  )
}

function DeleteDialog({
  post,
  onClose,
  onDone,
}: {
  post: BlogPostListItem | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!post) return
    setBusy(true)
    try {
      await api(`/v1/blog/posts/${post.id}`, { method: "DELETE" })
      setError(null)
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
      open={post !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${post?.title ?? ""}?`}
      description="It comes off your website at once, and stops being the featured post if it was."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            isLoading={busy}
            onClick={remove}
          >
            Delete
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
