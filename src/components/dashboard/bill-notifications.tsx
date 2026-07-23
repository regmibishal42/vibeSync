"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { todayLocalISO } from "@/lib/format";
import type { UpcomingBill } from "@/components/dashboard/upcoming-bills";

const STORAGE_KEY = "vibesync:bill-notifications";

// Purely client-side, zero push infrastructure — checks on app open and
// notifies if a bill is due soon and hasn't already been notified today.
// Not a background/lock-screen push; the Notification API only fires while
// this tab is open (or shortly after), which is the explicitly agreed scope.
function useBillNotifications(bills: UpcomingBill[]) {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const today = todayLocalISO();
    const seen: Record<string, string> = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}"
    );

    for (const bill of bills) {
      const daysUntil = differenceInCalendarDays(
        new Date(`${bill.next_due_date}T00:00:00`),
        new Date(`${today}T00:00:00`)
      );
      if (daysUntil <= 3 && seen[bill.id] !== today) {
        new Notification("Bill due soon", {
          body: `${bill.label} is due ${daysUntil <= 0 ? "today" : `in ${daysUntil} day(s)`}.`,
          tag: `bill-${bill.id}`,
        });
        seen[bill.id] = today;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }, [bills]);
}

function subscribeToNothing() {
  // The Notification API has no reliable cross-browser permission-change
  // event — permission only ever changes in response to the explicit
  // requestPermission() call handled below, so there's nothing to subscribe
  // to. useSyncExternalStore is used here purely for its designed purpose of
  // reading a browser global that doesn't exist during SSR without a
  // hydration mismatch — not for actually observing external changes.
  return () => {};
}

function getPermissionSnapshot(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function getServerPermissionSnapshot(): NotificationPermission | "unsupported" {
  return "default";
}

export function BillNotifications({ bills }: { bills: UpcomingBill[] }) {
  useBillNotifications(bills);

  const syncedPermission = useSyncExternalStore(
    subscribeToNothing,
    getPermissionSnapshot,
    getServerPermissionSnapshot
  );
  // requestPermission()'s result isn't observable through the store above
  // (there's no change event to re-sync from), so the button's own click
  // handler tracks the outcome directly and takes precedence once set.
  const [requested, setRequested] = useState<NotificationPermission | null>(null);
  const permission = requested ?? syncedPermission;

  if (permission === "unsupported" || permission === "granted" || bills.length === 0) {
    return null;
  }

  if (permission === "denied") {
    return (
      <p className="text-muted-foreground text-xs">
        Reminders blocked — enable notifications in your browser&apos;s site settings.
      </p>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => setRequested(await Notification.requestPermission())}
    >
      <Bell className="size-4" />
      Enable due-date reminders
    </Button>
  );
}
