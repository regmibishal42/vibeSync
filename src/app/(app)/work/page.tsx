import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Briefcase, Clock, HandCoins } from "lucide-react";

import { getJobsData, getPayoutBatchesData } from "@/app/(app)/work/data";
import { formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { JobForm } from "@/components/work/job-form";
import { EmptyState } from "@/components/ui/empty-state";
import { HoursThisMonth } from "@/components/work/hours-this-month";
import { JobCard } from "@/components/work/job-card";
import { PayoutBatchList } from "@/components/work/payout-batch-list";

// Validated at build time to produce an instant shell on client navigation.
// `runtime` rather than `static`: the (app) layout is `instant = false`
// (entry depends on the session cookie), and a `static` child under an
// exempted layout has no shell to attach to — validation rejects it outright.
const EarningsChart = dynamic(
  () => import("@/components/work/earnings-chart").then((m) => m.EarningsChart),
  { loading: () => <ChartSkeleton /> }
);

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Work</h1>

      <Suspense fallback={<WorkSummarySkeleton />}>
        <WorkSummary />
      </Suspense>
    </div>
  );
}

async function WorkSummary() {
  const { profile, jobs, shifts, salaries, accounts } = await getJobsData();
  const currency = profile?.currency_preference ?? "AUD";

  const hourlyJobs = jobs.filter((j) => j.pay_type === "HOURLY");
  const pendingPayout = shifts
    .filter((s) => s.payout_status === "PENDING")
    .reduce((sum, s) => sum + s.calculated_pay, 0);

  const salariesByJob = new Map(salaries.filter((s) => s.job_id).map((s) => [s.job_id!, s]));
  const shiftsByJob = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    shiftsByJob.set(shift.job_id, [...(shiftsByJob.get(shift.job_id) ?? []), shift]);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Active jobs"
          value={jobs.filter((j) => j.is_active).length.toString()}
          icon={<Briefcase className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="Hours this month"
          value={<HoursThisMonth shifts={shifts} />}
          icon={<Clock className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="Pending payout"
          value={formatCurrency(pendingPayout, currency)}
          icon={<HandCoins className="size-4" />}
          accent="warning"
        />
      </div>

      {hourlyJobs.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-medium">Last 14 days</h2>
          <EarningsChart shifts={shifts} />
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jobs</h2>
          <JobForm accounts={accounts} />
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          accent="shift"
          title="No jobs yet"
          description="Add where your money comes from — full-time or part-time, paid hourly or on a salary."
          hint="Hourly jobs track shifts and settle into payouts. Salaried jobs post automatically on payday."
          action={<JobForm accounts={accounts} />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              shifts={shiftsByJob.get(job.id) ?? []}
              salary={salariesByJob.get(job.id)}
              currency={currency}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Payout history</h2>
        <Suspense fallback={<ListSkeleton rows={2} />}>
          <PayoutHistory
            jobNames={new Map(jobs.map((j) => [j.id, j.name]))}
            currency={currency}
          />
        </Suspense>
      </div>
    </>
  );
}

async function PayoutHistory({
  jobNames,
  currency,
}: {
  jobNames: Map<string, string>;
  currency: string;
}) {
  const batches = await getPayoutBatchesData();
  return <PayoutBatchList batches={batches} jobNames={jobNames} currency={currency} />;
}

function WorkSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatGridSkeleton count={3} columns={2} />
      <ChartSkeleton />
      <ListSkeleton />
    </div>
  );
}
