import { redirect } from "next/navigation"

// The catalog is the home of the admin.
export default function Home() {
  redirect("/products")
}
