"use client"

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import { ChevronDown, ImagePlus, Pencil, Search, X } from "lucide-react"
import { useEffect, useState } from "react"

import Input from "@/components/form/input/InputField"
import { CategoryManager } from "@/components/ui/blog/CategoryManager"
import { RichTextEditor } from "@/components/ui/blog/RichTextEditor"
import { TagInput } from "@/components/ui/blog/TagInput"
import Badge from "@/components/ui/badge/Badge"
import Button from "@/components/ui/button/Button"
import { DatePicker } from "@/components/ui/common/DatePicker"
import { Dropzone } from "@/components/ui/common/Dropzone"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, fieldClasses, Textarea } from "@/components/ui/common/Field"
import { Card, Page, Section } from "@/components/ui/common/Page"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { Select } from "@/components/ui/common/Select"
import { TimePicker } from "@/components/ui/common/TimePicker"
import { Toggle } from "@/components/ui/common/Toggle"
import { ApiError } from "@/lib/api/client"
import type {
  BlogCategoryList,
  BlogPost,
  BlogPostStatus,
  ProductPage,
  UserPage,
} from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import {
  createBodyOf,
  draftOf,
  emptyDraft,
  isFuture,
  joinDateTime,
  patchOf,
  postState,
  splitDateTime,
  type PickedProduct,
  type PostDraft,
} from "@/lib/blog/post-form"
import { slugify } from "@/lib/catalog/slug"
import { uploadCover, xhrPut } from "@/lib/catalog/upload"
import { CheckLineIcon } from "@/icons"
import { dateTimeInputRFC3339, formatDateTime } from "@/lib/format"
import { cx } from "@/lib/utils"

const stateBadge = {
  draft: { label: "Draft", color: "light" },
  scheduled: { label: "Scheduled", color: "warning" },
  published: { label: "Published", color: "success" },
} as const

/** The API's limit on a post's products (04-api-spec.md §13.2). */
const maxProducts = 12

/**
 * The blog post editor (P1-607, 04-api-spec.md §13.2): the words on the left;
 * on the right a WordPress-style summary (status, publish date, slug, author,
 * each opening its editor) and folded panels for the optional fields. Status is
 * set by the action buttons, not a field: Save draft / Publish (Schedule when
 * the date is later), or Unpublish / Update once live. The cover uploads on
 * its own once the post exists, so it never blocks the form.
 */
export function PostEditor({
  post,
  onSaved,
}: {
  /** null: a new post. */
  post: BlogPost | null
  onSaved: (p: BlogPost) => void
}) {
  const api = useApi()
  const { user, tenant } = useSession()
  const canWrite = useCan("blog:write")
  const canUsers = useCan("users:read")
  const archived = Boolean(post?.archived_at)
  const editable = canWrite && !archived

  // The form re-seeds only for another post or after its own save; a cover
  // upload updates the post and must not wipe what someone is typing.
  const [base, setBase] = useState(post)
  const [draft, setDraft] = useState<PostDraft>(() =>
    post ? draftOf(post) : emptyDraft(user?.id),
  )
  if (post && post.id !== base?.id) {
    setBase(post)
    setDraft(draftOf(post))
  }
  // A new post's author is whoever writes it (BR-133); the session can
  // arrive after the first render.
  const [authorSeeded, setAuthorSeeded] = useState(Boolean(post || user))
  if (!authorSeeded && user) {
    setAuthorSeeded(true)
    setDraft((d) => ({ ...d, author_id: user.id }))
  }
  const original = base ? draftOf(base) : emptyDraft(user?.id)
  const dirty = Object.keys(patchOf(original, draft)).length > 0
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState<"draft" | "published" | "save" | null>(
    null,
  )

  const { data: categories, reload: reloadCategories } =
    useResource<BlogCategoryList>("/v1/blog/categories")
  const { data: users } = useResource<UserPage>(
    canUsers ? "/v1/users?status=active&limit=200" : null,
  )
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = (p: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...p }))

  /** Saves the draft, with status when an action button sets it. */
  async function save(status?: BlogPostStatus) {
    const next = status ? { ...draft, status } : draft
    const patch = patchOf(original, next)
    if (!next.title.trim() || (post && Object.keys(patch).length === 0)) return
    setSaving(status ?? "save")
    try {
      const saved = post
        ? await api<BlogPost>(`/v1/blog/posts/${post.id}`, {
            method: "PATCH",
            body: patch,
          })
        : await api<BlogPost>("/v1/blog/posts", {
            method: "POST",
            body: createBodyOf(next),
          })
      setError(null)
      setBase(saved)
      setDraft(draftOf(saved))
      onSaved(saved)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(null)
    }
  }

  const err = (field: string) => fieldError(error, field)
  const claimed = [
    "title",
    "slug",
    "excerpt",
    "body",
    "category_id",
    "author_id",
    "tags",
    "status",
    "published_at",
    "is_featured",
    "product_ids",
  ].some((f) => err(f))
  const live = post !== null && post.status === "published"
  const state = post ? postState(post) : "draft"
  const later = isFuture(draft.published_at)
  const { date, time } = splitDateTime(draft.published_at)
  // Authors: the shop's active staff, plus the post's own and the signed-in
  // user, who may not be listed (users:read is owner and admin only).
  const authors = new Map((users?.data ?? []).map((u) => [u.id, u.name]))
  if (post?.author && !authors.has(post.author.id))
    authors.set(post.author.id, post.author.name)
  if (user && !authors.has(user.id)) authors.set(user.id, user.name)

  return (
    <Page
      wide
      back={{
        href: "/blog",
        label: "posts",
        onClick: (e) => {
          if (dirty && !confirm("Leave without saving your changes?"))
            e.preventDefault()
        },
      }}
      title={post ? post.title : "New post"}
      description={
        archived
          ? "Deleted: off your website and read-only."
          : "Your website shows it on its journal page."
      }
    >
      <div className="flex flex-col gap-6">
        {error && !claimed && (
          <ErrorNotice error={error} title="Could not save the post" />
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Section id="post" title="Post">
              {/* Enter in the title saves, keeping the post's status. */}
              <form
                id="post-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save()
                }}
              >
                <fieldset disabled={!editable} className="flex flex-col gap-5">
                  <Field id="title" label="Title" error={err("title")}>
                    <Input
                      id="title"
                      value={draft.title}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </Field>
                  <Field id="body" label="Body" error={err("body")}>
                    <RichTextEditor
                      key={post?.id ?? "new"}
                      id="body"
                      value={draft.body}
                      disabled={!editable}
                      onChange={(body) => set({ body })}
                    />
                  </Field>
                </fieldset>
              </form>
            </Section>
            <Section
              id="cover"
              title="Cover"
              description="One image for the post's card, the featured spot and the top of the post. Its alt text is the title."
            >
              {post ? (
                <CoverField
                  post={post}
                  canWrite={editable}
                  onChanged={onSaved}
                />
              ) : (
                <NotYet>Create the post to add a cover.</NotYet>
              )}
            </Section>
            <Section
              id="products"
              title="Shop the guide"
              description="Products shown under the post, in this order. Hidden products drop out on your website."
            >
              <ProductPicker
                value={draft.products}
                canWrite={editable}
                error={err("product_ids")}
                onChange={(products) => set({ products })}
              />
            </Section>
          </div>

          <aside
            aria-label="Publishing and organisation"
            className="flex flex-col gap-6 xl:self-start"
          >
            <Section title="Publishing">
              <div className="flex flex-col">
                <SummaryRow
                  label="Status"
                  value={
                    <Badge size="sm" color={stateBadge[state].color}>
                      {stateBadge[state].label}
                    </Badge>
                  }
                />
                <SummaryRow
                  label="Publish"
                  value={
                    draft.published_at
                      ? formatDateTime(
                          dateTimeInputRFC3339(draft.published_at),
                          tenant?.timezone,
                        )
                      : "Immediately"
                  }
                  open={Boolean(err("published_at"))}
                  editable={editable}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <DatePicker
                        aria-label="Publish date"
                        className="flex-1"
                        value={date}
                        error={Boolean(err("published_at"))}
                        onChange={(d) =>
                          set({ published_at: joinDateTime(d, time) })
                        }
                      />
                      <TimePicker
                        aria-label="Publish time"
                        className="w-32"
                        value={time}
                        disabled={date === ""}
                        onChange={(t) =>
                          set({ published_at: joinDateTime(date, t) })
                        }
                      />
                    </div>
                    <FieldNote error={err("published_at")}>
                      In WIB. A later date schedules the post.
                    </FieldNote>
                    {draft.published_at && (
                      <button
                        type="button"
                        className="self-start text-xs font-medium text-brand-500 hover:text-brand-600"
                        onClick={() => set({ published_at: "" })}
                      >
                        Publish immediately instead
                      </button>
                    )}
                  </div>
                </SummaryRow>
                <SummaryRow
                  label="Slug"
                  value={(post ? draft.slug : slugify(draft.title)) || "—"}
                  open={Boolean(err("slug"))}
                  editable={editable && post !== null}
                >
                  <Input
                    aria-label="Slug"
                    value={draft.slug}
                    error={Boolean(err("slug"))}
                    onChange={(e) => set({ slug: e.target.value })}
                  />
                  <FieldNote error={err("slug")}>
                    {draft.slug !== original.slug
                      ? `Links to ${original.slug} will stop working once you save.`
                      : "The post's address on your website. Changing the title never changes it."}
                  </FieldNote>
                </SummaryRow>
                <SummaryRow
                  label="Author"
                  value={
                    authors.get(draft.author_id)
                      ? `${authors.get(draft.author_id)}${draft.author_id === user?.id ? " (you)" : ""}`
                      : "No author"
                  }
                  open={Boolean(err("author_id"))}
                  editable={editable}
                >
                  <Select
                    aria-label="Author"
                    className="w-full"
                    value={draft.author_id}
                    onChange={(v) => set({ author_id: v })}
                    options={[
                      { value: "", label: "No author" },
                      ...[...authors].map(([id, name]) => ({
                        value: id,
                        label: id === user?.id ? `${name} (you)` : name,
                      })),
                    ]}
                  />
                  <FieldNote error={err("author_id")} />
                </SummaryRow>
                <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      Featured post
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Shown first on your journal page; replaces the current
                      featured post.
                    </p>
                  </div>
                  <Toggle
                    label="Featured post"
                    checked={draft.is_featured}
                    disabled={!editable}
                    onChange={(on) => set({ is_featured: on })}
                  />
                </div>
              </div>
              {editable && (
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
                  {live ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={saving === "draft"}
                        disabled={saving !== null}
                        onClick={() => void save("draft")}
                      >
                        Unpublish
                      </Button>
                      <Button
                        size="sm"
                        isLoading={saving === "save"}
                        disabled={
                          !dirty || !draft.title.trim() || saving !== null
                        }
                        onClick={() => void save()}
                      >
                        Update
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={saving === "draft"}
                        disabled={
                          !draft.title.trim() ||
                          (post !== null && !dirty) ||
                          saving !== null
                        }
                        onClick={() => void save("draft")}
                      >
                        Save draft
                      </Button>
                      <Button
                        size="sm"
                        isLoading={saving === "published"}
                        disabled={!draft.title.trim() || saving !== null}
                        onClick={() => void save("published")}
                      >
                        {later ? "Schedule" : "Publish"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Section>
            {/* Optional fields fold away, WordPress style: each panel's
                header says what it holds, so nothing hides without a hint. */}
            <Card className="divide-y divide-gray-100 px-6 dark:divide-white/[0.05]">
              <Panel
                title="Excerpt"
                summary={draft.excerpt.trim() ? "Written" : "Automatic"}
                open={Boolean(err("excerpt"))}
              >
                <Textarea
                  aria-label="Excerpt"
                  rows={4}
                  disabled={!editable}
                  value={draft.excerpt}
                  placeholder={post?.excerpt_preview ?? ""}
                  hasError={Boolean(err("excerpt"))}
                  onChange={(e) => set({ excerpt: e.target.value })}
                />
                <FieldNote error={err("excerpt")}>
                  Shown on the post&apos;s card and to search engines. Leave it
                  empty to use the start of the post, as shown.
                </FieldNote>
              </Panel>
              <Panel
                title="Category"
                summary={
                  categories?.data.find((c) => c.id === draft.category_id)
                    ?.name ?? "None"
                }
                open={Boolean(err("category_id"))}
              >
                <Select
                  aria-label="Category"
                  className="w-full"
                  disabled={!editable}
                  value={draft.category_id}
                  onChange={(v) => set({ category_id: v })}
                  options={[
                    { value: "", label: "No category" },
                    ...(categories?.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
                <FieldNote error={err("category_id")} />
                {editable && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-brand-500 hover:text-brand-600"
                    onClick={() => setManaging(true)}
                  >
                    Manage categories
                  </button>
                )}
              </Panel>
              <Panel
                title="Tags"
                summary={
                  draft.tags.length
                    ? `${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}`
                    : "None"
                }
                open={Boolean(err("tags"))}
              >
                <TagInput
                  id="tags"
                  aria-label="Tags"
                  value={draft.tags}
                  disabled={!editable}
                  error={Boolean(err("tags"))}
                  onChange={(tags) => set({ tags })}
                />
                <FieldNote error={err("tags")}>
                  Enter or a comma adds a tag. Up to 10.
                </FieldNote>
              </Panel>
            </Card>
          </aside>
        </div>
      </div>
      {managing && (
        <CategoryManager
          open
          categories={categories?.data ?? []}
          onClose={() => setManaging(false)}
          onChanged={reloadCategories}
          onCreated={(c) => set({ category_id: c.id })}
        />
      )}
    </Page>
  )
}

/** Upload, replace or remove the cover; each saves at once (BR-135). */
function CoverField({
  post,
  canWrite,
  onChanged,
}: {
  post: BlogPost
  canWrite: boolean
  onChanged: (p: BlogPost) => void
}) {
  const api = useApi()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setCover(key: string | null) {
    onChanged(
      await api<BlogPost>(`/v1/blog/posts/${post.id}`, {
        method: "PATCH",
        body: { cover_r2_key: key },
      }),
    )
  }

  async function upload(files: File[]) {
    const file = files[0]
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      await setCover(await uploadCover(api, post.id, file, xhrPut, setProgress))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {post.cover_url && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- the image domain is the shop's, not a Next loader's */}
          <img
            src={post.cover_url}
            alt={post.title}
            className="aspect-[21/9] w-full rounded-xl object-cover"
          />
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="absolute right-3 top-3"
              onClick={() =>
                void setCover(null).catch((e) =>
                  setError(asApiError(e).message),
                )
              }
            >
              Remove cover
            </Button>
          )}
        </div>
      )}
      {canWrite && (
        <Dropzone accept="image/jpeg,image/png,image/webp" onFiles={upload}>
          <ImagePlus className="size-6" aria-hidden />
          <p>
            {post.cover_url ? "Replace the cover" : "Drop a cover"}: JPEG, PNG
            or WebP up to 20 MB, or
          </p>
        </Dropzone>
      )}
      {progress !== null && (
        <ProgressBar value={progress} max={1} label="Uploading the cover" />
      )}
      {error && <p className="text-xs text-error-500">{error}</p>}
      {!post.cover_url && !canWrite && (
        <p className="text-theme-sm text-gray-500">No cover.</p>
      )}
    </div>
  )
}

/**
 * Shop the guide (BR-134): the chosen products as numbered cards, and a
 * search that lists active products as you type (the first ten when you
 * click in). A chosen product shows a filled check and "Selected" in the
 * list, so the choice never rests on colour alone; at most 12.
 */
function ProductPicker({
  value,
  canWrite,
  error,
  onChange,
}: {
  value: PickedProduct[]
  canWrite: boolean
  error?: string
  onChange: (products: PickedProduct[]) => void
}) {
  const [typed, setTyped] = useState("")
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 250)
    return () => clearTimeout(t)
  }, [typed])
  const params = new URLSearchParams({ status: "active", limit: "10" })
  if (q) params.set("q", q)
  const { data: results, error: searchError } = useResource<ProductPage>(
    open ? `/v1/products?${params}` : null,
  )
  const full = value.length >= maxProducts
  const picked = new Set(value.map((p) => p.id))
  const options: PickedProduct[] = (results?.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    cover_url: p.cover_url,
  }))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {value.length
          ? `${value.length} of ${maxProducts} products selected`
          : "No products linked yet. Search to add the ones this post mentions; only active products can be added."}
      </p>
      {value.length > 0 && (
        <ol
          aria-label="Linked products"
          className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2 dark:border-brand-500/30 dark:bg-brand-500/[0.06]"
        >
          {value.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 shadow-theme-xs dark:bg-gray-900"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white">
                {i + 1}
              </span>
              <Thumb url={p.cover_url} className="size-12" />
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {p.title}
              </span>
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remove ${p.title}`}
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                >
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-xs text-error-500">{error}</p>}
      {canWrite && (
        <Combobox
          multiple
          immediate
          by="id"
          value={value}
          onChange={(next: PickedProduct[]) =>
            onChange(next.slice(0, maxProducts))
          }
          onClose={() => setTyped("")}
        >
          <div className="relative w-full max-w-md">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            />
            <ComboboxInput
              aria-label="Search products to add"
              placeholder="Search active products to add"
              className={cx(fieldClasses(), "h-11 pl-10")}
              value={typed}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setOpen(true)
                setTyped(e.target.value)
              }}
            />
          </div>
          <ComboboxOptions
            anchor="bottom start"
            className="z-999999 w-[var(--input-width)] min-w-80 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg [--anchor-gap:4px] [--anchor-max-height:22rem] focus:outline-none dark:border-gray-800 dark:bg-gray-dark"
          >
            <ErrorNotice
              error={searchError}
              title="Could not search the catalog"
            />
            {results && options.length === 0 && (
              <p className="px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400">
                {q
                  ? "No active product matches."
                  : "No active products yet. Activate a product to add it here."}
              </p>
            )}
            {full && (
              <p className="px-3 py-2 text-theme-xs text-gray-500 dark:text-gray-400">
                {maxProducts} is the most a post can show; remove one to add
                another.
              </p>
            )}
            {options.map((p) => (
              <ComboboxOption
                key={p.id}
                value={p}
                disabled={full && !picked.has(p.id)}
                className={cx(
                  "group flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300",
                  "data-[focus]:bg-gray-100 data-[selected]:bg-brand-50 dark:data-[focus]:bg-white/5 dark:data-[selected]:bg-brand-500/10",
                  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded border border-gray-300 group-data-[selected]:border-brand-500 group-data-[selected]:bg-brand-500 dark:border-gray-700"
                >
                  <CheckLineIcon className="invisible size-3.5 text-white group-data-[selected]:visible" />
                </span>
                <Thumb url={p.cover_url} className="size-10" />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="hidden text-theme-xs font-semibold text-brand-600 group-data-[selected]:inline dark:text-brand-400">
                  Selected
                </span>
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </Combobox>
      )}
    </div>
  )
}

/** A product's cover thumbnail, or an empty tile when it has none yet. */
function Thumb({ url, className }: { url: string | null; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a 200 px thumbnail from the image domain
    <img
      src={url}
      alt=""
      className={cx("shrink-0 rounded object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cx(
        "shrink-0 rounded bg-gray-100 dark:bg-white/[0.05]",
        className,
      )}
    />
  )
}

/**
 * One line of the post summary, WordPress style: the label, and the value as
 * a link that opens its editor underneath. Without children it is read-only.
 * open forces it open, for a field the API refused.
 */
function SummaryRow({
  label,
  value,
  open,
  editable = false,
  children,
}: {
  label: string
  value: React.ReactNode
  open?: boolean
  editable?: boolean
  children?: React.ReactNode
}) {
  const row =
    "flex min-h-10 w-full items-center justify-between gap-4 py-2 text-sm"
  const name = (
    <span className="shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
  )
  if (!children || !editable)
    return (
      <div className={row}>
        {name}
        <span className="min-w-0 truncate text-right font-medium text-gray-800 dark:text-white/90">
          {value}
        </span>
      </div>
    )
  return (
    <Disclosure key={open ? "open" : "closed"} defaultOpen={open}>
      <DisclosureButton
        className={cx(
          row,
          "-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]",
        )}
      >
        {name}
        <span className="flex min-w-0 items-center gap-1.5 font-medium text-brand-500">
          <span className="truncate">{value}</span>
          <Pencil aria-hidden className="size-3.5 shrink-0" />
        </span>
      </DisclosureButton>
      <DisclosurePanel className="pb-3 pt-1">{children}</DisclosurePanel>
    </Disclosure>
  )
}

/** A folded section of optional fields; its header summarises what is in it. */
function Panel({
  title,
  summary,
  open,
  children,
}: {
  title: string
  summary: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <Disclosure as="div" key={open ? "open" : "closed"} defaultOpen={open}>
      <DisclosureButton className="group flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left">
        <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">{summary}</span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 transition-transform duration-200 group-data-[open]:rotate-180"
          />
        </span>
      </DisclosureButton>
      <DisclosurePanel className="pb-4">{children}</DisclosurePanel>
    </Disclosure>
  )
}

/** A field's error, or its hint when there is none. */
function FieldNote({
  error,
  children,
}: {
  error?: string
  children?: React.ReactNode
}) {
  if (error) return <p className="mt-1.5 text-xs text-error-500">{error}</p>
  if (!children) return null
  return (
    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
      {children}
    </p>
  )
}

function NotYet({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {children}
    </p>
  )
}
