import type { Media, PresignResponse } from "@/lib/api/types"

type Api = <T>(
  path: string,
  options?: { method?: string; body?: unknown },
) => Promise<T>
export type Put = (
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
) => Promise<void>

export const imageTypes = ["image/jpeg", "image/png", "image/webp"]
export const maxImageBytes = 20 * 1024 * 1024

/** The file's SHA-256, hex: the key carries it, so the same image is one object (BR-053). */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Uploads one image: presign, PUT the bytes straight to the store, confirm
 * (04-api-spec.md §8). The API sees the file's type, size and hash, never its
 * bytes (BR-051).
 */
export async function uploadImage(
  api: Api,
  productId: string,
  file: File,
  put: Put,
  onProgress: (f: number) => void,
): Promise<Media> {
  if (!imageTypes.includes(file.type))
    throw new Error(`${file.name} is not a JPEG, PNG or WebP image.`)
  if (file.size > maxImageBytes) throw new Error(`${file.name} is over 20 MB.`)
  const presign = await api<PresignResponse>("/v1/media/presign", {
    method: "POST",
    body: {
      purpose: "product_image",
      product_id: productId,
      mime_type: file.type,
      bytes: file.size,
      sha256: await sha256Hex(file),
    },
  })
  await put(presign.upload_url, file, onProgress)
  return api<Media>("/v1/media/confirm", {
    method: "POST",
    body: { r2_key: presign.r2_key, product_id: productId },
  })
}

/** A PUT with real progress, which fetch cannot report for uploads. */
export const xhrPut: Put = (url, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status < 300
        ? resolve()
        : reject(new Error(`The upload failed (${xhr.status}).`))
    xhr.onerror = () =>
      reject(
        new Error("The upload failed; check the connection and try again."),
      )
    xhr.send(file)
  })
