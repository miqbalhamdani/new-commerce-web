import Link from "next/link"

import type { DashboardProduct } from "@/lib/api/types"
import { formatMoney } from "@/lib/format"

/** The period's five best sellers by sales (P1-114, BR-066). No stock: there is none (BR-017). */
export function TopProducts({ products }: { products: DashboardProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
        No sales in this period yet.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-theme-sm">
        <thead className="border-b border-gray-100 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <tr>
            <th className="py-3 pr-4 font-medium">Product</th>
            <th className="py-3 pr-4 text-right font-medium">Items sold</th>
            <th className="py-3 text-right font-medium">Sales</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {products.map((p) => (
            <tr key={p.product_id}>
              <td className="py-3 pr-4">
                <Link
                  href={`/products/${p.product_id}`}
                  className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                >
                  {p.title}
                </Link>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {p.items_sold}
              </td>
              <td className="py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {formatMoney(p.sales)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
