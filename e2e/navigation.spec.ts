import { test, expect, type Page } from "@playwright/test";

// Answers the question the reported symptom raises: when you switch tabs and
// come back, does the app actually refetch, or does it serve what it already
// has? Measured by counting the RSC payload requests the router makes, which
// is objective — unlike "it feels slow".
//
// Credentials come from .env.local (gitignored); the suite skips rather than
// fails if they're absent, so it stays runnable on a fresh clone.
const EMAIL = process.env.SEED_PARTNER_EMAIL;
const PASSWORD = process.env.SEED_PARTNER_PASSWORD;

const TABS = ["/", "/wallet", "/work", "/loans"] as const;

// Scoped to the nav landmark: the dashboard also renders quick-link cards
// pointing at the same routes, so an unscoped role query is ambiguous.
function tab(page: Page, href: string) {
  return page.getByRole("navigation").getByRole("link", { name: tabLabel(href) });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

// An RSC navigation request — what the router fetches when it can't serve a
// segment from its own cache. Prefetches are excluded: those are the router
// warming itself up, which is the behaviour we *want*.
function isNavigationFetch(url: string, headers: Record<string, string>) {
  return (
    (url.includes("_rsc=") || headers["rsc"] === "1") &&
    headers["next-router-prefetch"] !== "1"
  );
}

test.describe("tab navigation", () => {
  test.skip(!EMAIL || !PASSWORD, "SEED_PARTNER_* not set in .env.local");

  test("returning to a tab does not refetch it", async ({ page }) => {
    await signIn(page);

    // Visit every tab once so the router has seen them all.
    for (const href of TABS) {
      await tab(page, href).click();
      await page.waitForURL(`**${href}`);
      await page.waitForLoadState("networkidle");
    }

    // Now count what a *return* visit costs.
    const navFetches: string[] = [];
    page.on("request", (req) => {
      if (isNavigationFetch(req.url(), req.headers())) navFetches.push(req.url());
    });

    for (const href of TABS) {
      await tab(page, href).click();
      await page.waitForURL(`**${href}`);
      await page.waitForTimeout(400);
    }

    console.log(
      `\n  return visits to ${TABS.length} tabs -> ${navFetches.length} RSC navigation fetches`
    );
    for (const u of navFetches) console.log("    " + u.replace(/^https?:\/\/[^/]+/, ""));

    // Asserted at zero, deliberately. This was 4-of-4 before
    // `staleTimes.dynamic` was set (it defaults to 0 — "not cached" — in
    // Next 15+, and every route here is Partial Prerender, so the router
    // never reused the dynamic half). If this number climbs again, tab
    // switching has started refetching and the regression is caught here
    // rather than by someone noticing the app "feels like it reloads".
    expect(
      navFetches.length,
      "returning to an already-visited tab refetched it — check staleTimes in next.config.ts"
    ).toBe(0);
  });

  test("the shell stays mounted across tabs (no full reload)", async ({ page }) => {
    await signIn(page);

    // Stamp the live DOM. A full document reload wipes it; a client-side
    // navigation cannot.
    await page.evaluate(() => {
      (window as unknown as { __vibesyncMarker?: number }).__vibesyncMarker = Date.now();
    });

    for (const href of TABS) {
      await tab(page, href).click();
      await page.waitForURL(`**${href}`);
    }

    const marker = await page.evaluate(
      () => (window as unknown as { __vibesyncMarker?: number }).__vibesyncMarker
    );
    expect(marker, "shell remounted — navigation caused a full page load").toBeDefined();
  });
});

function tabLabel(href: string): RegExp {
  switch (href) {
    case "/":
      return /^Home$/;
    case "/wallet":
      return /^Wallet$/;
    case "/work":
      return /^Work$/;
    default:
      return /^Loans$/;
  }
}
