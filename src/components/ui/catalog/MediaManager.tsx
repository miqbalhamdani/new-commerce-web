"use client"

import { ImagePlus } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/Button"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { NativeSelect } from "@/components/ui/common/Field"
import { Card } from "@/components/ui/common/Page"
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
  const input = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [order, setOrder] = useState<Media[] | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
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
    <Card className="p-6">
      {canWrite && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault()
              setOver(true)
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return
            e.preventDefault()
            setOver(false)
            upload(e.dataTransfer.files)
          }}
          className={cx(
            "mb-4 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-gray-500",
            over
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 dark:border-gray-700",
          )}
        >
          <ImagePlus className="size-6" aria-hidden />
          <p>Drop JPEG, PNG or WebP images here (up to 20 MB each), or</p>
          <Button variant="secondary" onClick={() => input.current?.click()}>
            Choose files
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.name} className="text-sm">
              <div className="flex justify-between">
                <span>{u.name}</span>
                <span className={u.error ? "text-red-700" : "text-gray-500"}>
                  {u.error ?? `${Math.round(u.progress * 100)}%`}
                </span>
              </div>
              {!u.error && (
                <progress
                  className="w-full"
                  value={u.progress}
                  max={1}
                  aria-label={`Uploading ${u.name}`}
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
          {media.map((m, i) => (
            <li
              key={m.id}
              draggable={canWrite}
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => dragging !== null && e.preventDefault()}
              onDrop={() => void drop(i)}
              className={cx(
                "flex flex-col gap-2 rounded border border-gray-200 p-2 dark:border-gray-800",
                dragging === i && "opacity-50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the store's own derivative */}
              <img
                src={m.derivatives["800"] ?? m.url}
                alt={`Image ${i + 1}`}
                className="aspect-square w-full rounded object-cover"
              />
              {i === 0 && (
                <span className="text-xs font-medium text-gray-600">Cover</span>
              )}
              {canWrite ? (
                <>
                  <NativeSelect
                    aria-label={`Variant for image ${i + 1}`}
                    value={m.variant_id ?? ""}
                    onChange={(e) =>
                      void act(() =>
                        api(`/v1/media/${m.id}`, {
                          method: "PATCH",
                          body: { variant_id: e.target.value || null },
                        }),
                      )
                    }
                  >
                    <option value="">Whole product</option>
                    {variants?.data.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.option_values.join(" / ") || v.sku || "Variant"}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void act(() =>
                        api(`/v1/media/${m.id}`, { method: "DELETE" }),
                      )
                    }
                  >
                    Delete
                  </Button>
                </>
              ) : (
                m.variant_id && (
                  <span className="text-xs text-gray-500">Variant image</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
