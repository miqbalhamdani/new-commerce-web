import { describe, expect, it, vi } from "vitest"

import { uploadBodyImage, uploadCover, uploadHero, uploadImage, uploadLogo } from "./upload"

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

describe("uploadCover (P1-607)", () => {
  it("presigns under the post, puts the bytes, and returns the key with no confirm (BR-135)", async () => {
    const file = new File([new Uint8Array([1, 2])], "cover.jpg", {
      type: "image/jpeg",
    })
    const api = vi.fn(async () => ({
      upload_url: "http://store/put",
      r2_key: "t/blogs/post1/abc.jpg",
      expires_in: 600,
    })) as never
    const put = vi.fn(async () => undefined)

    const key = await uploadCover(api, "post1", file, put, vi.fn())

    expect(key).toBe("t/blogs/post1/abc.jpg")
    expect(put).toHaveBeenCalledOnce()
    expect(api).toHaveBeenCalledOnce()
    expect(vi.mocked(api as (...a: unknown[]) => unknown).mock.calls[0]).toEqual([
      "/v1/media/presign",
      {
        method: "POST",
        body: expect.objectContaining({
          purpose: "blog_cover",
          post_id: "post1",
          mime_type: "image/jpeg",
          bytes: 2,
        }),
      },
    ])
  })
})

describe("uploadBodyImage (P1-607)", () => {
  it("presigns a blog_image under the post and returns where it is served (BR-135)", async () => {
    const file = new File([new Uint8Array([1, 2])], "sprei.webp", {
      type: "image/webp",
    })
    const api = vi.fn(async () => ({
      upload_url: "http://store/put",
      r2_key: "t/blogs/post1/abc.webp",
      expires_in: 600,
      public_url: "http://img/t/blogs/post1/abc.webp",
    })) as never
    const put = vi.fn(async () => undefined)

    const url = await uploadBodyImage(api, "post1", file, put)

    expect(url).toBe("http://img/t/blogs/post1/abc.webp")
    expect(put).toHaveBeenCalledOnce()
    expect(vi.mocked(api as (...a: unknown[]) => unknown).mock.calls[0]).toEqual([
      "/v1/media/presign",
      {
        method: "POST",
        body: expect.objectContaining({
          purpose: "blog_image",
          post_id: "post1",
          mime_type: "image/webp",
        }),
      },
    ])
  })
})

describe("uploadLogo (P1-704)", () => {
  it("presigns a shop_logo, puts the bytes, and returns its key and URL (BR-142)", async () => {
    const file = new File([new Uint8Array([1, 2])], "logo.png", {
      type: "image/png",
    })
    const api = vi.fn(async () => ({
      upload_url: "http://store/put",
      r2_key: "t/shop/abc.png",
      expires_in: 600,
      public_url: "http://img/t/shop/abc.png",
    })) as never
    const put = vi.fn(async () => undefined)

    const logo = await uploadLogo(api, file, put, vi.fn())

    expect(logo).toEqual({ key: "t/shop/abc.png", url: "http://img/t/shop/abc.png" })
    expect(put).toHaveBeenCalledOnce()
    expect(vi.mocked(api as (...a: unknown[]) => unknown).mock.calls[0]).toEqual([
      "/v1/media/presign",
      {
        method: "POST",
        body: expect.objectContaining({ purpose: "shop_logo", mime_type: "image/png", bytes: 2 }),
      },
    ])
  })

  it("refuses a logo over 2 MB before signing anything", async () => {
    const api = vi.fn()
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })
    await expect(uploadLogo(api as never, big, vi.fn(), vi.fn())).rejects.toThrow(/over 2 MB/)
    expect(api).not.toHaveBeenCalled()
  })
})

describe("uploadHero (P1-805)", () => {
  it("presigns a shop_hero up to 5 MB and refuses more before signing (BR-142)", async () => {
    const api = vi.fn(async () => ({
      upload_url: "http://store/put",
      r2_key: "t/shop/def.jpg",
      expires_in: 600,
      public_url: "http://img/t/shop/def.jpg",
    }))
    const fits = new File([new Uint8Array(5 * 1024 * 1024)], "hero.jpg", { type: "image/jpeg" })
    expect(await uploadHero(api as never, fits, vi.fn(async () => undefined), vi.fn())).toEqual({
      key: "t/shop/def.jpg",
      url: "http://img/t/shop/def.jpg",
    })
    expect(vi.mocked(api as (...a: unknown[]) => unknown).mock.calls[0][1]).toMatchObject({
      body: { purpose: "shop_hero" },
    })

    api.mockClear()
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })
    await expect(uploadHero(api as never, big, vi.fn(), vi.fn())).rejects.toThrow(/over 5 MB/)
    expect(api).not.toHaveBeenCalled()
  })
})
