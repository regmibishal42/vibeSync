import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="glow-fitness flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-finance via-shift to-fitness">
          <span className="text-2xl font-bold text-white">VS</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold">VibeSync</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to see your side of the sync.
          </p>
        </div>
      </div>

      <div className="border-border/60 bg-card w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <LoginForm />
      </div>
    </main>
  );
}
