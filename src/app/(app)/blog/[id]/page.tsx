"use client"

import { use } from "react"

import { PostEditor } from "@/components/ui/blog/PostEditor"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Loading } from "@/components/ui/common/Page"
import type { BlogPost } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"

// The blog post editor (P1-607).

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const {
    data: post,
    setData,
    error,
    loading,
  } = useResource<BlogPost>(`/v1/blog/posts/${id}`)

  if (loading && !post) return <Loading />
  if (!post)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the post" />
      </div>
    )
  return <PostEditor post={post} onSaved={setData} />
}
