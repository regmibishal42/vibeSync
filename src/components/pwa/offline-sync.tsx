"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { flushQuickAddQueue, queuedCount } from "@/lib/offline-queue";

// Mounted once in the app shell. Flushes any quick-add entries queued while
// offline (see lib/offline-queue.ts) on mount and whenever the browser
// regains connectivity — covers the real case (phone gets signal back while
// the app is open) without needing the Background Sync API.
export function OfflineSync() {
  const router = useRouter();

  useEffect(() => {
    async function flush() {
      if (queuedCount() === 0) return;
      const { flushed, remaining } = await flushQuickAddQueue();
      if (flushed > 0) {
        toast.success(
          `Synced ${flushed} queued ${flushed === 1 ? "entry" : "entries"}` +
            (remaining > 0 ? ` — ${remaining} still pending` : "")
        );
        router.refresh();
      }
    }

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [router]);

  return null;
}
