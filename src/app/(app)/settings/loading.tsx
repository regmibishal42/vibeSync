// Prefetched shell for the settings tab. Every other route under (app) has
// one; without it, instant validation had nothing to hand the router on
// navigation and refused to validate the segment at all.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-32 animate-pulse rounded" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-20 w-full animate-pulse rounded-xl" />
      <div className="bg-muted h-72 w-full animate-pulse rounded-xl" />
    </div>
  );
}
