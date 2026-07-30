// Shared tag names between each data.ts fetcher's `cacheTag(...)` call and
// the Server Actions/route handlers that must invalidate them on write.
// One source of truth so a typo can't silently desync a mutation from the
// exact reads it's supposed to invalidate — Next's `revalidatePath` from a
// Server Action currently busts *every* previously-visited page on next
// navigation (a documented, temporary Next.js limitation), which is why
// every mutation here uses tag-scoped `updateTag`/`revalidateTag` instead:
// switching to an unrelated tab no longer re-fetches data that didn't change.
export const CACHE_TAGS = {
  walletAccounts: "wallet-accounts",
  walletTransactions: "wallet-transactions",
  recurringTransactions: "recurring-transactions",
  dashboardAccounts: "dashboard-accounts",
  dashboardTransactions: "dashboard-transactions",
  dashboardJobs: "dashboard-jobs",
  dashboardRecurring: "dashboard-recurring",
  dashboardLoans: "dashboard-loans",
  workJobs: "work-jobs",
  workPayoutBatches: "work-payout-batches",
  loans: "loans",
} as const;
