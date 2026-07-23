import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";

// Prefetched for <Link> taps to the home route — shown the instant a user
// taps the Home nav item, before the destination page's own code has even
// started executing server-side. Complementary to (not a duplicate of) the
// finer-grained in-page <Suspense> boundaries in page.tsx, which take over
// once real rendering starts.
export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted h-7 w-40 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-24 w-full animate-pulse rounded-2xl" />
      <StatGridSkeleton count={2} columns={2} />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted h-24 animate-pulse rounded-xl" />
        <div className="bg-muted h-24 animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
