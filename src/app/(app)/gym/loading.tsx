import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

export default function GymLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-20 animate-pulse rounded" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-12 w-full animate-pulse rounded-lg" />
      <StatGridSkeleton count={3} columns={3} />
      <ChartSkeleton />
      <ListSkeleton />
    </div>
  );
}
