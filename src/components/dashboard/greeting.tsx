"use client";

import { useIsClient } from "@/lib/use-is-client";

// "What time is it for this person" is a client question, not a server one.
// Rendering it on the server was wrong twice over: the value got baked into
// the prerendered shell, and it used the *server's* timezone — so a user in
// Nepal (UTC+5:45) or Sydney (UTC+10) could be greeted "Good morning" at 8pm.
//
// Shows the neutral "Welcome back" during SSR/hydration, then the time-aware
// greeting — never a confidently *wrong* one.
function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  const isClient = useIsClient();
  const greeting = isClient ? greetingFor(new Date().getHours()) : "Welcome back";

  return <p className="text-muted-foreground text-sm">{greeting},</p>;
}
