"use client"

import {
  CloseButton,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Popover,
  PopoverButton,
  PopoverPanel,
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import {
  ChevronDown,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

import Input from "@/components/form/input/InputField"
import { CategoryManager } from "@/components/ui/blog/CategoryManager"
import { RichTextEditor } from "@/components/ui/blog/RichTextEditor"
import { TagInput } from "@/components/ui/blog/TagInput"
import Button from "@/components/ui/button/Button"
import { DatePicker } from "@/components/ui/common/DatePicker"
import { Dialog } from "@/components/ui/common/Dialog"
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
import { uploadBodyImage, uploadCover, xhrPut } from "@/lib/catalog/upload"
import { CheckLineIcon } from "@/icons"
import { dateTimeInputRFC3339, formatDateTime } from "@/lib/format"
import { cx } from "@/lib/utils"

/** The post's state as the product editor shows a product's: a dot and a word. */
const statusLook = {
  draft: { label: "Draft", dot: "bg-gray-400" },
  scheduled: { label: "Scheduled", dot: "bg-warning-500" },
  published: { label: "Published", dot: "bg-success-500" },
} as const

/** The API's limit on a post's products (04-api-spec.md §13.2). */
const maxProducts = 12

/**
 * The blog post editor (P1-607, 04-api-spec.md §13.2): the words on the left;
 * on the right three cards: the status with its actions, the details
 * (publish date, slug, author, featured; each opens its editor) and folded
 * panels for the optional fields. Status is
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
  // A new post's slug follows its title until typed over, cleared included.
  const [slugTyped, setSlugTyped] = useState(false)

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
                      // Images go under the post, so it must exist first.
                      uploadImage={
                        post && editable
                          ? (file) =>
                              uploadBodyImage(api, post.id, file, xhrPut)
                          : undefined
                      }
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
            <Section title="Status">
              {/* As a product's status: a dot, the state, what it means. */}
              <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                <span
                  aria-hidden
                  className={cx(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    statusLook[state].dot,
                  )}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {statusLook[state].label}
                  </p>
                  <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
                    {!post
                      ? "Starts as a draft until you publish it."
                      : state === "draft"
                        ? "Hidden from your website."
                        : state === "scheduled"
                          ? `Goes live by itself on ${formatDateTime(post.published_at, tenant?.timezone)}.`
                          : `Live on your website since ${formatDateTime(post.published_at, tenant?.timezone)}.`}
                  </p>
                </div>
              </div>
              {editable && (
                <div className="mt-5 grid grid-cols-2 gap-3">
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
            <Section title="Details">
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05]">
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
                  error={err("published_at")}
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
                  value={
                    draft.slug ||
                    slugify(draft.title) || (
                      <span className="text-gray-400 dark:text-gray-500">
                        Set from the title
                      </span>
                    )
                  }
                  error={err("slug")}
                  editable={editable}
                >
                  <Input
                    aria-label="Slug"
                    value={
                      post || slugTyped ? draft.slug : slugify(draft.title)
                    }
                    error={Boolean(err("slug"))}
                    onChange={(e) => {
                      setSlugTyped(true)
                      set({ slug: e.target.value })
                    }}
                  />
                  <FieldNote error={err("slug")}>
                    {!post
                      ? "Generated from the title until you change it."
                      : draft.slug !== original.slug
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
                  error={err("author_id")}
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
                <div className="flex min-h-14 items-center gap-4 py-4">
                  <span className={rowLabel}>Featured</span>
                  <p className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
                    Shown first on your journal page; replaces the current
                    featured post.
                  </p>
                  <Toggle
                    label="Featured post"
                    checked={draft.is_featured}
                    disabled={!editable}
                    onChange={(on) => set({ is_featured: on })}
                  />
                </div>
              </div>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => setManaging(true)}
                  >
                    <SlidersHorizontal className="size-4" aria-hidden />
                    Manage categories
                  </Button>
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

/**
 * Upload or remove the cover; each saves at once (BR-135). The drop box shows
 * only while there is no cover: to change it, remove it first.
 */
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
      {canWrite && !post.cover_url && (
        <Dropzone accept="image/jpeg,image/png,image/webp" onFiles={upload}>
          <ImagePlus className="size-6" aria-hidden />
          <p>Drop a cover: JPEG, PNG or WebP up to 20 MB, or</p>
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
 * Shop the guide (BR-134): the chosen products as numbered cards, and Add
 * products, which opens a modal to search active products (the first 20
 * when empty) with each one's category. The card sits at the bottom of the
 * page, so the list gets the modal's room rather than a squeezed dropdown.
 * A chosen product shows a filled check and "Selected", so the choice never
 * rests on colour alone; at most 12.
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
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {value.length
          ? `${value.length} of ${maxProducts} products selected`
          : "No products linked yet. Add the ones this post mentions; only active products can be added."}
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
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" aria-hidden />
          Add products
        </Button>
      )}
      <Dialog
        open={adding}
        onOpenChange={setAdding}
        size="lg"
        title="Add products"
        description={`Only active products can be added; a post shows up to ${maxProducts}.`}
      >
        <ProductSearch value={value} onChange={onChange} />
      </Dialog>
    </div>
  )
}

/** The Add products modal's body: a search and a tall list to tick. */
function ProductSearch({
  value,
  onChange,
}: {
  value: PickedProduct[]
  onChange: (products: PickedProduct[]) => void
}) {
  const [typed, setTyped] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 250)
    return () => clearTimeout(t)
  }, [typed])
  const params = new URLSearchParams({ status: "active", limit: "20" })
  if (q) params.set("q", q)
  const { data: results, error: searchError } = useResource<ProductPage>(
    `/v1/products?${params}`,
  )
  const full = value.length >= maxProducts
  const picked = new Set(value.map((p) => p.id))
  const options = results?.data ?? []

  return (
    <Combobox
      multiple
      by="id"
      value={value}
      onChange={(next: PickedProduct[]) =>
        // Options are list items; keep only what the post holds.
        onChange(
          next
            .slice(0, maxProducts)
            .map(({ id, title, cover_url }) => ({ id, title, cover_url })),
        )
      }
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400"
        />
        <ComboboxInput
          aria-label="Search products to add"
          placeholder="Search active products"
          className={cx(fieldClasses(), "h-11 pl-10")}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      <ErrorNotice error={searchError} title="Could not search the catalog" />
      {full && (
        <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
          {maxProducts} is the most a post can show; untick one to add another.
        </p>
      )}
      <ComboboxOptions
        static
        className="custom-scrollbar mt-3 flex max-h-[min(28rem,55vh)] flex-col divide-y divide-gray-100 overflow-y-auto focus:outline-none dark:divide-white/[0.05]"
      >
        {results && options.length === 0 && (
          <p className="px-3 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
            {q
              ? "No active product matches."
              : "No active products yet. Activate a product to add it here."}
          </p>
        )}
        {options.map((p) => (
          <ComboboxOption
            key={p.id}
            value={p}
            disabled={full && !picked.has(p.id)}
            className={cx(
              "group flex min-h-16 cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
              "data-[focus]:bg-gray-50 data-[selected]:bg-brand-50 dark:data-[focus]:bg-white/5 dark:data-[selected]:bg-brand-500/10",
              "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            )}
          >
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded border border-gray-300 group-data-[selected]:border-brand-500 group-data-[selected]:bg-brand-500 dark:border-gray-700"
            >
              <CheckLineIcon className="invisible size-3.5 text-white group-data-[selected]:visible" />
            </span>
            <Thumb url={p.cover_url} className="size-12" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
                {p.title}
              </span>
              <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                {p.categories.map((c) => c.name).join(", ") || "No category"}
              </span>
            </span>
            <span className="hidden text-theme-xs font-semibold text-brand-600 group-data-[selected]:inline dark:text-brand-400">
              Selected
            </span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
      <p className="mt-4 text-theme-sm text-gray-500 dark:text-gray-400">
        {value.length} of {maxProducts} selected
        {results?.next_cursor &&
          " · Showing the first 20; search to find others."}
      </p>
    </Combobox>
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

/** A summary row's label. */
const rowLabel = "shrink-0 text-sm text-gray-500 dark:text-gray-400"

/**
 * One line of the post's details, WordPress style: the label, and the value
 * in the label's size, a brand link with a pencil when it can be changed. Its
 * editor opens in a popover beside the column, titled and with a close
 * button. A field the API refused shows its error under the row.
 */
function SummaryRow({
  label,
  value,
  error,
  editable = false,
  children,
}: {
  label: string
  value: React.ReactNode
  error?: string
  editable?: boolean
  children?: React.ReactNode
}) {
  if (!children || !editable)
    return (
      <div className="flex min-h-14 items-center justify-between gap-4 py-4">
        <span className={rowLabel}>{label}</span>
        <span className="min-w-0 truncate text-right text-sm text-gray-800 dark:text-white/90">
          {value}
        </span>
      </div>
    )
  return (
    <Popover className="py-1">
      <PopoverButton className="focus-visible:ring-3 -mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center justify-between gap-4 rounded-lg px-2 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-brand-500/10 data-[open]:bg-brand-50 dark:hover:bg-white/[0.03] dark:data-[open]:bg-brand-500/[0.12]">
        <span className={rowLabel}>{label}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-brand-500">
          <span className="truncate">{value}</span>
          <Pencil aria-hidden className="size-3.5 shrink-0" />
        </span>
      </PopoverButton>
      {error && <p className="pb-2 text-xs text-error-500">{error}</p>}
      <PopoverPanel
        anchor="left start"
        className="z-99999 w-80 rounded-xl border border-gray-200 bg-white p-5 shadow-theme-lg [--anchor-gap:24px] focus:outline-none dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {label}
          </h3>
          <CloseButton
            aria-label={`Close ${label.toLowerCase()}`}
            className="-mr-2 flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <X aria-hidden className="size-5" />
          </CloseButton>
        </div>
        {children}
      </PopoverPanel>
    </Popover>
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
