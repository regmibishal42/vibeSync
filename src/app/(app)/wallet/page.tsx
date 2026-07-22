import type { Metadata } from "next";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/profile";
import { StatCard } from "@/components/dashboard/stat-card";
import { AccountCard } from "@/components/wallet/account-card";
import { AccountForm } from "@/components/wallet/account-form";
import { TransactionForm } from "@/components/wallet/transaction-form";
import { TransactionList } from "@/components/wallet/transaction-list";
import { BalanceChart } from "@/components/wallet/balance-chart";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Wallet" };

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const { quick } = await searchParams;
  const [profile, user, supabase] = await Promise.all([
    getCurrentProfile(),
    getCurrentUser(),
    createClient(),
  ]);

  const [{ data: accountsData }, { data: transactionsData }, { data: profilesData }] =
    await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("id, currency_preference"),
    ]);

  const accounts = accountsData ?? [];
  const transactions = transactionsData ?? [];
  const currency = profile?.currency_preference ?? "AUD";
  const isAdmin = profile?.role === "ADMIN";

  // Accounts don't carry their own currency column — each one's currency is
  // implicitly its owner's profile.currency_preference. Needed so the ADMIN
  // (who can see the PARTNER's accounts too) doesn't render her AUD amounts
  // with an NPR label just because the viewer's own currency is NPR.
  const currencyByUserId = new Map(
    (profilesData ?? []).map((p) => [p.id, p.currency_preference])
  );

  const ownAccounts = accounts.filter((a) => a.user_id === user?.id);
  const myAccounts = ownAccounts.filter((a) => !a.is_parent_account);
  const parentAccounts = ownAccounts.filter((a) => a.is_parent_account);
  const otherAccounts = accounts.filter((a) => a.user_id !== user?.id);

  // Net worth / month in / month out are scoped to the viewer's own
  // accounts only — summing balances across the ADMIN's NPR accounts and
  // the PARTNER's AUD accounts into one number would be financially
  // meaningless without an FX conversion this app doesn't do.
  const ownAccountIds = new Set(ownAccounts.map((a) => a.id));
  const ownTransactions = transactions.filter((t) => ownAccountIds.has(t.account_id));

  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);
  const monthTx = ownTransactions.filter((t) => isThisMonth(t.transaction_date));
  const monthIncome = monthTx
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = monthTx
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const chartData = ownAccounts.map((a) => ({
    name: a.account_name,
    balance: a.current_balance,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-muted-foreground text-sm">
          Every account, one real-time ledger.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Net worth"
          value={formatCurrency(netWorth, currency)}
          icon={<Wallet className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Month in"
          value={formatCurrency(monthIncome, currency)}
          icon={<TrendingUp className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Month out"
          value={formatCurrency(monthExpense, currency)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      {ownAccounts.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">Balances</h2>
          <BalanceChart data={chartData} />
        </div>
      ) : null}

      <div className="flex gap-2">
        <AccountForm isAdmin={isAdmin} />
        <TransactionForm accounts={accounts} defaultOpen={quick === "expense"} />
      </div>

      {myAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">My accounts</h2>
          {myAccounts.map((a) => (
            <AccountCard key={a.id} account={a} currency={currency} />
          ))}
        </section>
      ) : null}

      {parentAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Parents&apos; accounts</h2>
          {parentAccounts.map((a) => (
            <AccountCard key={a.id} account={a} currency={currency} />
          ))}
        </section>
      ) : null}

      {otherAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {isAdmin ? "Partner's accounts" : "Shared accounts"}
          </h2>
          {otherAccounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              currency={currencyByUserId.get(a.user_id) ?? currency}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Recent transactions</h2>
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          currencyByUserId={currencyByUserId}
          fallbackCurrency={currency}
        />
      </section>
    </div>
  );
}
