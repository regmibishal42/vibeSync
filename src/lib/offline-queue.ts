"use client";

// ponytail: a localStorage-backed queue with best-effort flush on
// 'online'/mount, not the Background Sync API. Background Sync has no
// support on iOS Safari — most of this app's real usage — so registering a
// sync event would silently never fire there. Flushing on reconnect covers
// the actual case (phone regains signal while the app is open or gets
// refocused) without that platform gap. Upgrade path: a real IndexedDB
// queue + Background Sync registration if broader background delivery
// (app fully closed while offline) is ever needed.
const QUEUE_KEY = "vibesync:quick-add-queue:v1";

export type QueuedQuickAdd = {
  queueId: string;
  accountId: string;
  type: "EXPENSE" | "DEPOSIT";
  amount: number;
  category?: string;
  merchantOrItem?: string;
  transactionDate: string;
};

function readQueue(): QueuedQuickAdd[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedQuickAdd[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueQuickAdd(entry: QueuedQuickAdd) {
  writeQueue([...readQueue(), entry]);
}

export function queuedCount(): number {
  return readQueue().length;
}

export async function flushQuickAddQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const stillQueued: QueuedQuickAdd[] = [];
  let flushed = 0;

  for (const entry of queue) {
    try {
      const res = await fetch("/api/wallet/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // queueId doubles as clientId so a retry of an entry that actually
        // landed (but whose response was lost) is absorbed server-side as a
        // no-op instead of posting the expense a second time.
        body: JSON.stringify({ ...entry, clientId: entry.queueId }),
      });
      if (res.ok) {
        flushed++;
      } else {
        stillQueued.push(entry);
      }
    } catch {
      // Still offline (or a transient network error) — keep it queued and
      // retry on the next flush trigger.
      stillQueued.push(entry);
    }
  }

  writeQueue(stillQueued);
  return { flushed, remaining: stillQueued.length };
}
