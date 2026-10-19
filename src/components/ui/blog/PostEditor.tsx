"use client"

import { ImagePlus, X } from "lucide-react"
import { useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dropzone } from "@/components/ui/common/Dropzone"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Field, Textarea } from "@/components/ui/common/Field"
import { Page, Section } from "@/components/ui/common/Page"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type {
  BlogCategoryList,
  BlogPost,
  ProductPage,
  UserPage,
} from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import {
  createBodyOf,
  draftOf,
  emptyDraft,
  patchOf,
  postState,
  type PickedProduct,
  type PostDraft,
} from "@/lib/blog/post-form"
import { slugify } from "@/lib/catalog/slug"
import { uploadCover, xhrPut } from "@/lib/catalog/upload"
import { formatDateTime } from "@/lib/format"

const stateLine = {
  draft: "Hidden from your website.",
  scheduled: "Goes live on your website by itself at its date.",
  published: "Live on your website.",
} as const

/**
 * The blog post editor (P1-607, 04-api-spec.md §13.2): the post's words in the
 * main column, publishing and organisation in a side panel, one Save. The
 * cover uploads on its own once the post exists, so it never blocks the form.
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
    post ? draftOf(post) : emptyDraft(),
  )
  if (post && post.id !== base?.id) {
    setBase(post)
    setDraft(draftOf(post))
  }
  const original = base ? draftOf(base) : emptyDraft()
  const patch = patchOf(original, draft)
  const dirty = Object.keys(patch).length > 0
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: categories } = useResource<BlogCategoryList>(
    "/v1/blog/categories",
  )
  const { data: users } = useResource<UserPage>(
    canUsers ? "/v1/users?status=active&limit=200" : null,
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = (p: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...p }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty || !draft.title.trim()) return
    setSaving(true)
    try {
      const saved = post
        ? await api<BlogPost>(`/v1/blog/posts/${post.id}`, {
            method: "PATCH",
            body: patch,
          })
        : await api<BlogPost>("/v1/blog/posts", {
            method: "POST",
            body: createBodyOf(draft),
          })
      setError(null)
      setBase(saved)
      setDraft(draftOf(saved))
      onSaved(saved)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
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
  const state = post ? postState(post) : "draft"
  // Authors: the shop's active staff, plus the post's own if no longer listed.
  const authors = new Map((users?.data ?? []).map((u) => [u.id, u.name]))
  if (post?.author && !authors.has(post.author.id))
    authors.set(post.author.id, post.author.name)
  if (post && user && !authors.has(user.id)) authors.set(user.id, user.name)

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
              <form id="post-form" onSubmit={save}>
                <fieldset disabled={!editable} className="flex flex-col gap-5">
                  <Field id="title" label="Title" error={err("title")}>
                    <Input
                      id="title"
                      value={draft.title}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </Field>
                  <Field
                    id="slug"
                    label="Slug"
                    error={err("slug")}
                    hint={
                      !post
                        ? "Generated from the title. You can change it after creating."
                        : draft.slug !== original.slug
                          ? undefined
                          : "The post's address on your website. Changing the title never changes it."
                    }
                  >
                    <Input
                      id="slug"
                      value={post ? draft.slug : slugify(draft.title)}
                      readOnly={!post}
                      className={
                        post ? "" : "!bg-gray-50 dark:!bg-white/[0.03]"
                      }
                      onChange={(e) => set({ slug: e.target.value })}
                    />
                    {post && draft.slug !== original.slug && (
                      <p
                        role="alert"
                        className="text-xs text-warning-600 dark:text-orange-400"
                      >
                        Links to {original.slug} will stop working once you
                        save.
                      </p>
                    )}
                  </Field>
                  <Field
                    id="excerpt"
                    label="Excerpt"
                    error={err("excerpt")}
                    hint="Shown on the post's card and to search engines. Leave it empty to use the start of the post, as shown."
                  >
                    <Textarea
                      id="excerpt"
                      rows={3}
                      value={draft.excerpt}
                      placeholder={post?.excerpt_preview ?? ""}
                      hasError={Boolean(err("excerpt"))}
                      onChange={(e) => set({ excerpt: e.target.value })}
                    />
                  </Field>
                  <Field
                    id="body"
                    label="Body"
                    error={err("body")}
                    hint="Markdown: ## for a heading, [text](link) for a link, - for a list, > for the boxed Kesimpulan."
                  >
                    <Textarea
                      id="body"
                      rows={20}
                      className="font-mono"
                      value={draft.body}
                      hasError={Boolean(err("body"))}
                      onChange={(e) => set({ body: e.target.value })}
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
              <fieldset disabled={!editable} className="flex flex-col gap-4">
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  {post
                    ? state === "draft"
                      ? stateLine.draft
                      : `${stateLine[state]} ${formatDateTime(post.published_at, tenant?.timezone)}`
                    : "Starts as a draft unless you publish it."}
                </p>
                <Field id="status" label="Status" error={err("status")}>
                  <Select
                    id="status"
                    className="w-full"
                    value={draft.status}
                    onChange={(v) => set({ status: v as PostDraft["status"] })}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "published", label: "Published" },
                    ]}
                  />
                </Field>
                <Field
                  id="published_at"
                  label="Publish date (WIB)"
                  error={err("published_at")}
                  hint="Empty publishes now. A later date schedules it."
                >
                  <Input
                    id="published_at"
                    type="datetime-local"
                    value={draft.published_at}
                    onChange={(e) => set({ published_at: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-400">
                  <Checkbox
                    checked={draft.is_featured}
                    onChange={(e) => set({ is_featured: e.target.checked })}
                  />
                  Feature it at the top of the journal page
                </label>
              </fieldset>
              {editable && (
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!dirty}
                    onClick={() => setDraft(original)}
                  >
                    Discard changes
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    form="post-form"
                    isLoading={saving}
                    disabled={!dirty || !draft.title.trim()}
                  >
                    {post ? "Save" : "Create post"}
                  </Button>
                </div>
              )}
            </Section>
            <Section title="Organization">
              <fieldset disabled={!editable} className="flex flex-col gap-5">
                <Field
                  id="category"
                  label="Category"
                  error={err("category_id")}
                >
                  <Select
                    id="category"
                    className="w-full"
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
                </Field>
                <Field id="author" label="Author" error={err("author_id")}>
                  <Select
                    id="author"
                    className="w-full"
                    value={draft.author_id}
                    onChange={(v) => set({ author_id: v })}
                    options={[
                      // On a new post, empty means whoever creates it (BR-133).
                      { value: "", label: post ? "No author" : "You" },
                      ...[...authors].map(([id, name]) => ({
                        value: id,
                        label: name,
                      })),
                    ]}
                  />
                </Field>
                <Field
                  id="tags"
                  label="Tags"
                  error={err("tags")}
                  hint="Separate with commas. Up to 10."
                >
                  <Input
                    id="tags"
                    value={draft.tags}
                    onChange={(e) => set({ tags: e.target.value })}
                  />
                </Field>
              </fieldset>
            </Section>
          </aside>
        </div>
      </div>
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

/** Search the catalog, add products as chips; at most 12 (BR-134). */
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
  const api = useApi()
  const [results, setResults] = useState<PickedProduct[] | null>(null)
  const [searchError, setSearchError] = useState<ApiError | null>(null)
  const picked = new Set(value.map((p) => p.id))

  async function search(q: string) {
    if (!q.trim()) return
    try {
      const page = await api<ProductPage>(
        `/v1/products?q=${encodeURIComponent(q.trim())}&status=active&limit=10`,
      )
      setResults(
        page.data.map((p) => ({
          id: p.id,
          title: p.title,
          cover_url: p.cover_url,
        })),
      )
      setSearchError(null)
    } catch (e) {
      setSearchError(asApiError(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ol className="flex flex-col gap-2" aria-label="Linked products">
          {value.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
            >
              <span className="w-5 text-theme-xs text-gray-400">{i + 1}</span>
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a 200 px thumbnail from the image domain
                <img
                  src={p.cover_url}
                  alt=""
                  className="size-9 rounded object-cover"
                />
              ) : (
                <span className="size-9 rounded bg-gray-100 dark:bg-white/[0.05]" />
              )}
              <span className="flex-1 text-sm text-gray-800 dark:text-white/90">
                {p.title}
              </span>
              {canWrite && (
                <button
                  type="button"
                  aria-label={`Remove ${p.title}`}
                  className="text-gray-400 hover:text-error-500"
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No products yet.
        </p>
      )}
      {error && <p className="text-xs text-error-500">{error}</p>}
      {canWrite && value.length < 12 && (
        <>
          <SearchInput
            aria-label="Search products to add"
            placeholder="Search products, Enter to look up"
            className="w-full max-w-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void search(e.currentTarget.value)
              }
            }}
          />
          <ErrorNotice
            error={searchError}
            title="Could not search the catalog"
          />
          {results?.length === 0 && (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Nothing in the live catalog matches.
            </p>
          )}
          {results && results.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Search results">
              {results.map((p) => (
                <li key={p.id}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={picked.has(p.id)}
                    onClick={() => onChange([...value, p])}
                  >
                    {picked.has(p.id) ? `${p.title} (added)` : `Add ${p.title}`}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function NotYet({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {children}
    </p>
  )
}
