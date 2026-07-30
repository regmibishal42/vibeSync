"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Catches anything thrown while rendering a route inside the authenticated
// shell (a Supabase outage, a failed query, a bad row) and keeps the user
// inside the app — the header and bottom nav stay mounted, so a transient
// failure on one tab never strands them on a blank page with no way back.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="bg-warning/15 text-warning flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Couldn&apos;t load this page</h2>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm">
          Something went wrong fetching your data. Your records are safe — this
          is only a display problem.
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCw className="size-4" />
        Try again
      </Button>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
