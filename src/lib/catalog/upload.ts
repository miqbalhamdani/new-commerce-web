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
  const presign = await presignImage(api, file, {
    purpose: "product_image",
    product_id: productId,
  })
  await put(presign.upload_url, file, onProgress)
  return api<Media>("/v1/media/confirm", {
    method: "POST",
    body: { r2_key: presign.r2_key, product_id: productId },
  })
}

/**
 * Uploads a blog post's cover: presign, PUT. There is no confirm; the
 * returned key is saved as the post's cover_r2_key (BR-135).
 */
export async function uploadCover(
  api: Api,
  postId: string,
  file: File,
  put: Put,
  onProgress: (f: number) => void,
): Promise<string> {
  const presign = await presignImage(api, file, {
    purpose: "blog_cover",
    post_id: postId,
  })
  await put(presign.upload_url, file, onProgress)
  return presign.r2_key
}

/**
 * Uploads an image for a blog post's body: presign, PUT. The body links it
 * by the returned public URL, as ![alt](url) (BR-135).
 */
export async function uploadBodyImage(
  api: Api,
  postId: string,
  file: File,
  put: Put,
): Promise<string> {
  const presign = await presignImage(api, file, {
    purpose: "blog_image",
    post_id: postId,
  })
  if (!presign.public_url) throw new Error("The upload has no public URL.")
  await put(presign.upload_url, file, () => {})
  return presign.public_url
}

/** Refuses what the store would refuse, before signing anything. */
async function presignImage(
  api: Api,
  file: File,
  target: Record<string, string>,
): Promise<PresignResponse> {
  if (!imageTypes.includes(file.type))
    throw new Error(`${file.name} is not a JPEG, PNG or WebP image.`)
  if (file.size > maxImageBytes) throw new Error(`${file.name} is over 20 MB.`)
  return api<PresignResponse>("/v1/media/presign", {
    method: "POST",
    body: {
      ...target,
      mime_type: file.type,
      bytes: file.size,
      sha256: await sha256Hex(file),
    },
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
