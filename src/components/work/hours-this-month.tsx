"use client";

import { useIsClient } from "@/lib/use-is-client";

type Shift = { shift_date: string; hours_worked: number };

// "This month" is the viewer's month, not the server's. Computed server-side
// it was frozen into the prerendered shell and evaluated in the server's
// timezone, so on the first or last day of a month it could report the wrong
// total for anyone off UTC.
export function HoursThisMonth({ shifts }: { shifts: Shift[] }) {
  const isClient = useIsClient();
  if (!isClient) return <>—</>;

  const now = new Date();
  const hours = shifts
    .filter((s) => {
      const d = new Date(`${s.shift_date}T00:00:00`);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, s) => sum + s.hours_worked, 0);

  return <>{hours.toFixed(1)}</>;
}
