"use client"

import { EyeOff, Globe } from "lucide-react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { ApiError } from "@/lib/api/client"
import type { Product } from "@/lib/api/types"
import { asApiError, useApi } from "@/lib/api/use-api"
import { failuresOf, type Failure } from "@/lib/catalog/publish"

/**
 * Publish and unpublish (P1-075). A refused publish lists every reason
 * (BR-038), each a link to the field or matrix cell that fixes it.
 */
export function PublishBar({
  product,
  onChanged,
  onFailures,
}: {
  product: Product
  onChanged: (p: Product) => void
  onFailures: (f: Failure[]) => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const failures = failuresOf(error)

  async function setStatus(status: "active" | "draft") {
    setBusy(true)
    try {
      const p = await api<Product>(`/v1/products/${product.id}`, {
        method: "PATCH",
        body: { status },
        headers: { "If-Match": String(product.version) },
      })
      setError(null)
      onFailures([])
      onChanged(p)
    } catch (err) {
      const e = asApiError(err)
      setError(e)
      onFailures(failuresOf(e))
    } finally {
      setBusy(false)
    }
  }

  function go(anchor: string) {
    const el = document.getElementById(anchor)
    el?.scrollIntoView({ block: "center" })
    if (el instanceof HTMLInputElement) el.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      {product.status === "draft" && (
        <Button
          size="sm"
          className="w-full"
          startIcon={<Globe aria-hidden className="size-4" />}
          isLoading={busy}
          onClick={() => setStatus("active")}
        >
          Publish product
        </Button>
      )}
      {product.status === "active" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          startIcon={<EyeOff aria-hidden className="size-4" />}
          isLoading={busy}
          onClick={() => setStatus("draft")}
        >
          Unpublish
        </Button>
      )}
      {failures.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-warning-500 bg-warning-50 p-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-400"
        >
          <p className="font-medium">Not published yet. Fix these first:</p>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((f, i) => (
              <li key={i}>
                <a
                  href={`#${f.anchor}`}
                  className="underline"
                  onClick={(e) => {
                    e.preventDefault()
                    go(f.anchor)
                  }}
                >
                  {f.detail}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ErrorNotice error={error} title="Could not change the status" />
      )}
    </div>
  )
}
