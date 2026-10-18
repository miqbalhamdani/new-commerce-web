import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { Card } from "@/components/ui/common/Page"
import type { DashboardTopCustomer } from "@/lib/api/types"
import { formatMoney } from "@/lib/format"

/**
 * The period's five best customers by sales, as TailAdmin's "Top Channels"
 * card (P1-116, BR-066): name and sales, with the way to every customer
 * beside the title. A customer with an account opens their page; a guest has
 * none, so their name stays plain.
 */
export function TopCustomers({
  customers,
}: {
  customers: DashboardTopCustomer[]
}) {
  return (
    <section aria-labelledby="top-customers-title">
      <Card>
        <div className="flex items-center justify-between gap-3 p-6 pb-5">
          <h2
            id="top-customers-title"
            className="text-base font-semibold text-gray-800 dark:text-white/90"
          >
            Top customers
          </h2>
          <ButtonLink href="/customers" variant="outline">
            All customers
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
        <div className="px-6 pb-6">
          {customers.length === 0 ? (
            <p className="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
              No customers in this period yet.
            </p>
          ) : (
            <table className="w-full text-left text-theme-sm">
              <thead className="border-b border-gray-100 text-theme-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <tr>
                  <th className="pb-3 pr-4 font-normal">Customer</th>
                  <th className="pb-3 text-right font-normal">Sales</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-gray-100 dark:[&>tr]:border-gray-800">
                {customers.map((c, i) => (
                  <tr key={c.customer_id ?? `guest-${i}`}>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                      {c.customer_id ? (
                        <Link
                          href={`/customers/${c.customer_id}`}
                          className="hover:text-brand-500 dark:hover:text-brand-400"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {formatMoney(c.sales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </section>
  )
}
