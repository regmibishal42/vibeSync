"use client";

import { useEffect } from "react";

// Last-resort boundary: only fires when the root layout itself fails, so it
// has to render its own <html>/<body> and cannot rely on any app styling,
// fonts, or components existing. Deliberately dependency-free and inline-styled.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fdf3eb",
          color: "#2b1d16",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>VibeSync hit a problem</h1>
        <p style={{ margin: 0, maxWidth: "22rem", fontSize: "0.875rem", opacity: 0.75 }}>
          The app failed to start up. Your data is untouched — reloading usually
          clears it.
        </p>
        <button
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "0.5rem",
            background: "#b8431a",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
