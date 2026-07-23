import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

export default function WorkLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted h-7 w-32 animate-pulse rounded" />
      <StatGridSkeleton count={4} columns={2} />
      <ChartSkeleton />
      <div className="bg-muted h-10 w-full animate-pulse rounded-lg" />
      <ListSkeleton />
    </div>
  );
}
