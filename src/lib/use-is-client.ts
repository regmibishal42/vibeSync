"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// True only once mounted in the browser.
//
// Several bits of this UI depend on the *viewer's* clock — the greeting, "this
// month" totals, "due in the next 14 days", the 14-day earnings buckets. All
// of them were previously computed on the server, which was wrong twice over:
// the value got frozen into the prerendered shell, and it used the server's
// timezone rather than the user's, so someone in Nepal (UTC+5:45) or Sydney
// (UTC+10) could see the wrong greeting or have a transaction land in the
// wrong month.
//
// This is the sanctioned way to read a browser-only fact without a hydration
// mismatch. Preferred over `useState` + `useEffect` because the value is then
// available during the first client render, so derived numbers can be
// computed inline rather than triggering a second render pass.
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
