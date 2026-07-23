// Fallback for the (app) layout's top-level Suspense boundary — only ever
// shown on a genuine first/hard load (client-side nav between the 4 routes
// re-renders below this shared layout, see src/app/(app)/layout.tsx). Shaped
// to match AppHeader/BottomNav's real dimensions so there's no layout shift
// when the real chrome resolves.
export function AppShellSkeleton() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <span className="bg-muted size-8 animate-pulse rounded-lg" />
          <span className="bg-muted h-4 w-20 animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-muted h-5 w-14 animate-pulse rounded-full" />
          <span className="bg-muted size-9 animate-pulse rounded-full" />
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-4 w-24 animate-pulse rounded" />
            <div className="bg-muted h-7 w-40 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-24 w-full animate-pulse rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted h-20 animate-pulse rounded-xl" />
            <div className="bg-muted h-20 animate-pulse rounded-xl" />
          </div>
        </div>
      </main>

      <nav
        className="border-border/60 bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-1.5">
              <span className="bg-muted size-5 animate-pulse rounded" />
              <span className="bg-muted h-2.5 w-8 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
