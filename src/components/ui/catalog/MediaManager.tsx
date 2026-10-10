"use client"

import { ImagePlus, Trash2 } from "lucide-react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { Dropzone } from "@/components/ui/common/Dropzone"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { Media, Product, Variant } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { uploadImage, xhrPut } from "@/lib/catalog/upload"
import { cx } from "@/lib/utils"

type Upload = { name: string; progress: number; error?: string }

/**
 * A product's images (P1-048, 04-api-spec.md §8): drop or pick files, which
 * go straight to the store with real progress (BR-051) while the rest of the
 * editor stays usable; drag thumbnails to reorder; attach an image to a
 * variant or back to the product; delete. Derivatives fill in once the worker
 * has made them (BR-052).
 */
export function MediaManager({
  product,
  canWrite,
  onChanged,
}: {
  product: Product
  canWrite: boolean
  onChanged: () => void
}) {
  const api = useApi()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [order, setOrder] = useState<Media[] | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  // The image waiting on the delete confirmation, with its 1-based number.
  const [deleting, setDeleting] = useState<{ id: string; n: number } | null>(
    null,
  )
  const { data: variants } = useResource<{ data: Variant[] }>(
    `/v1/products/${product.id}/variants`,
  )
  const media = order ?? product.media

  function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      setUploads((u) => [...u, { name: file.name, progress: 0 }])
      const progress = (p: number) =>
        setUploads((u) =>
          u.map((x) => (x.name === file.name ? { ...x, progress: p } : x)),
        )
      uploadImage(api, product.id, file, xhrPut, progress)
        .then(() => {
          setUploads((u) => u.filter((x) => x.name !== file.name))
          onChanged()
        })
        .catch((e: unknown) => {
          const message =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Upload failed."
          setUploads((u) =>
            u.map((x) => (x.name === file.name ? { ...x, error: message } : x)),
          )
        })
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn()
      setError(null)
      onChanged()
    } catch (e) {
      setError(asApiError(e))
    }
  }

  async function drop(to: number) {
    if (dragging === null || dragging === to) return
    const next = [...media]
    const [moved] = next.splice(dragging, 1)
    next.splice(to, 0, moved)
    setOrder(next)
    setDragging(null)
    await act(() =>
      api(`/v1/products/${product.id}/media/order`, {
        method: "PATCH",
        body: { media_ids: next.map((m) => m.id) },
      }),
    )
    setOrder(null)
  }

  return (
    <div>
      {canWrite && (
        <Dropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          onFiles={upload}
          className="mb-4"
        >
          <ImagePlus className="size-6" aria-hidden />
          <p>Drop JPEG, PNG or WebP images here (up to 20 MB each), or</p>
        </Dropzone>
      )}

      {uploads.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.name} className="text-sm">
              <div className="flex justify-between">
                <span>{u.name}</span>
                <span className={u.error ? "text-error-500" : "text-gray-500"}>
                  {u.error ?? `${Math.round(u.progress * 100)}%`}
                </span>
              </div>
              {!u.error && (
                <ProgressBar
                  value={u.progress}
                  max={1}
                  label={`Uploading ${u.name}`}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <ErrorNotice error={error} title="Could not update the images" />
      {media.length === 0 ? (
        <p className="text-sm text-gray-500">
          No images yet. A product needs at least one to be published.
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Images"
        >
          {media.map((m, i) => {
            const variant = variants?.data.find((v) => v.id === m.variant_id)
            return (
              <li
                key={m.id}
                draggable={canWrite}
                onDragStart={() => setDragging(i)}
                onDragOver={(e) => dragging !== null && e.preventDefault()}
                onDrop={() => void drop(i)}
                className={cx(
                  "flex flex-col gap-2 rounded-xl border border-gray-200 p-2 dark:border-gray-800",
                  canWrite && "cursor-grab active:cursor-grabbing",
                  dragging === i && "opacity-50",
                )}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the store's own derivative */}
                  <img
                    src={m.derivatives["800"] ?? m.url}
                    alt={i === 0 ? `Image ${i + 1}, cover` : `Image ${i + 1}`}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-theme-xs font-medium text-gray-800 shadow-theme-xs dark:bg-gray-900/80 dark:text-white/90">
                      Cover
                    </span>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      aria-label={`Delete image ${i + 1}`}
                      onClick={() => setDeleting({ id: m.id, n: i + 1 })}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow-theme-xs hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500/40 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:text-error-400"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
                {canWrite ? (
                  <Select
                    size="sm"
                    className="w-full"
                    aria-label={`Variant for image ${i + 1}`}
                    value={m.variant_id ?? ""}
                    onChange={(v) =>
                      void act(() =>
                        api(`/v1/media/${m.id}`, {
                          method: "PATCH",
                          body: { variant_id: v || null },
                        }),
                      )
                    }
                    options={[
                      { value: "", label: "All variants" },
                      ...(variants?.data.map((v) => ({
                        value: v.id,
                        label:
                          v.option_values.join(" / ") || v.sku || "Variant",
                      })) ?? []),
                    ]}
                  />
                ) : (
                  m.variant_id && (
                    <span className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {variant?.option_values.join(" / ") || "Variant image"}
                    </span>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete image ${deleting?.n ?? ""}?`}
        description="It's removed from the product and the store. This can't be undone."
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                const id = deleting!.id
                setDeleting(null)
                void act(() => api(`/v1/media/${id}`, { method: "DELETE" }))
              }}
            >
              Delete image
            </Button>
          </>
        }
      />
    </div>
  )
}
