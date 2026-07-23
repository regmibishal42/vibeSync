// Matches the h-48 chart-container footprint used by every recharts-based
// chart in this app (balance/earnings/progressive-overload) so a lazily
// next/dynamic-loaded chart doesn't cause a layout jump while its chunk and
// data resolve.
export function ChartSkeleton() {
  return <div className="bg-muted h-48 w-full animate-pulse rounded-lg" />;
}
