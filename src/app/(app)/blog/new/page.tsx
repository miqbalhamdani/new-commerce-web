"use client"

import { useRouter } from "next/navigation"

import { PostEditor } from "@/components/ui/blog/PostEditor"

// A new post: words first. Creating lands on the editor, where the cover is
// added (BR-135: its key carries the post's id).

export default function NewBlogPostPage() {
  const router = useRouter()
  return (
    <PostEditor post={null} onSaved={(p) => router.replace(`/blog/${p.id}`)} />
  )
}
