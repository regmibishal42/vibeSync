import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Matches StatCard's own footprint (Card, gap-2 py-4, label row + value row)
// so a stat grid streaming in doesn't shift layout.
export function StatGridSkeleton({
  count = 3,
  columns = 3,
  className,
}: {
  count?: number;
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 ? "grid-cols-2" : "grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-2 py-4">
          <div className="flex items-center justify-between px-4">
            <span className="bg-muted h-3 w-14 animate-pulse rounded" />
            <span className="bg-muted size-7 animate-pulse rounded-lg" />
          </div>
          <div className="px-4">
            <span className="bg-muted block h-6 w-16 animate-pulse rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}
