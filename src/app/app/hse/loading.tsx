import { Skeleton } from "@/components/ui/skeleton";

// Skeleton mientras carga cualquier sub-ruta de HSE (bajo la sub-nav).
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
