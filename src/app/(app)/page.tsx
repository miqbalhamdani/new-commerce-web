import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
        Catalog
      </h1>
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The product list arrives with P1-033. This page exists so the shell,
          the navigation and the session have somewhere to land.
        </p>
      </Card>
    </div>
  );
}
