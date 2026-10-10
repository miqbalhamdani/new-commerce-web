import { Table } from "@/components/ui/table"

/**
 * The one way a list screen wraps the vendored table: TailAdmin's
 * BasicTableOne shell. The vendored table primitives are unstyled, so the
 * cell classes live here too, used as
 * `<TableCell isHeader className={th}>` / `<TableCell className={td}>`.
 */
export const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
export const td = "px-5 py-4 text-start text-theme-sm"

/** Rows divide; the header gets its line via this class on TableHeader. */
export const headerRow = "border-b border-gray-100 dark:border-white/[0.05]"
export const bodyRows = "divide-y divide-gray-100 dark:divide-white/[0.05]"

export function ListTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>{children}</Table>
      </div>
    </div>
  )
}
