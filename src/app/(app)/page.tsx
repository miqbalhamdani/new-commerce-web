import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Products</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everything in your catalog.
        </p>
      </div>

      <Card className="flex flex-col items-start gap-2 py-10 text-center sm:items-center">
        <p className="text-sm font-medium text-ink">No products yet</p>
        <p className="max-w-md text-sm text-ink-muted">
          The product list arrives with P1-033. This page exists so the shell,
          the navigation and the session have somewhere to land.
        </p>
      </Card>
    </div>
  );
}
