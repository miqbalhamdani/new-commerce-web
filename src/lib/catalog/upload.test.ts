import { describe, expect, it, vi } from "vitest"

import { uploadImage } from "./upload"

describe("uploadImage (P1-048)", () => {
  it("sends the bytes to the store and only their description to the API (BR-051)", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "tee.png", {
      type: "image/png",
    })
    const calls: { path: string; body: unknown }[] = []
    const api = vi.fn(async (path: string, opts?: { body?: unknown }) => {
      calls.push({ path, body: opts?.body })
      return path.endsWith("presign")
        ? {
            upload_url: "http://store/put",
            r2_key: "t/products/p/abc.png",
            expires_in: 600,
          }
        : { id: "m1" }
    }) as never
    const put = vi.fn(
      async (_url: string, _f: File, progress: (n: number) => void) =>
        progress(1),
    )
    const progress = vi.fn()

    const media = await uploadImage(api, "p", file, put, progress)

    expect(media).toEqual({ id: "m1" })
    expect(put).toHaveBeenCalledWith("http://store/put", file, progress)
    expect(calls.map((c) => c.path)).toEqual([
      "/v1/media/presign",
      "/v1/media/confirm",
    ])
    expect(calls[0].body).toMatchObject({
      purpose: "product_image",
      mime_type: "image/png",
      bytes: 4,
    })
    expect((calls[0].body as { sha256: string }).sha256).toMatch(
      /^[0-9a-f]{64}$/,
    )
    expect(calls[1].body).toEqual({
      r2_key: "t/products/p/abc.png",
      product_id: "p",
    })
    expect(JSON.stringify(calls)).not.toContain("\u0001\u0002") // no bytes in any API body
  })

  it("refuses what the store would refuse, before signing anything", async () => {
    const api = vi.fn()
    await expect(
      uploadImage(
        api as never,
        "p",
        new File(["x"], "a.gif", { type: "image/gif" }),
        vi.fn(),
        vi.fn(),
      ),
    ).rejects.toThrow(/not a JPEG/)
    expect(api).not.toHaveBeenCalled()
  })
})
