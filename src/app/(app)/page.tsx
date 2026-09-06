export default function ProductsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Products
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          Everything in your catalog.
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            No products yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-500">
            The product list arrives with P1-033. This page exists so the shell,
            the navigation and the session have somewhere to land.
          </p>
        </div>
      </div>
    </div>
  )
}
