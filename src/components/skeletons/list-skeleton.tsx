import { Card } from "@/components/ui/card";

// Matches the shape of a row-per-item list card (transaction/shift/log
// lists all share this "icon + two text lines + trailing value" layout).
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="flex-row items-center gap-3 px-4 py-3">
          <span className="bg-muted size-9 shrink-0 animate-pulse rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="bg-muted h-3.5 w-2/5 animate-pulse rounded" />
            <span className="bg-muted h-3 w-1/4 animate-pulse rounded" />
          </div>
          <span className="bg-muted h-4 w-14 animate-pulse rounded" />
        </Card>
      ))}
    </div>
  );
}
