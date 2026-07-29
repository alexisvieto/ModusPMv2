import { Skeleton } from "@/components/ui/skeleton";

// Skeleton del editor de cotización mientras carga.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}
