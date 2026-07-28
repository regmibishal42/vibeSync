import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

export default function LoansLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted h-7 w-24 animate-pulse rounded" />
      <StatGridSkeleton count={2} columns={2} />
      <ListSkeleton rows={2} />
    </div>
  );
}
