-- Replaces transactions.category's free-text + client-side datalist with a
-- closed enum. Safe as a hard cutover: no live transactions exist yet
-- (scripts/seed.ts seeds accounts only), so there's no real data to
-- migrate — but the `using` clause below is still defensive rather than a
-- raw `::expense_category` cast, in case a future seed/test run has already
-- inserted free-text values before this migration runs.
do $$ begin
  create type expense_category as enum (
    'RENT',
    'SIM_PLAN',
    'GROCERIES',
    'TRAVEL',
    'UTILITIES',
    'TRANSPORT',
    'DINING',
    'HEALTH',
    'SHOPPING',
    'SUPPLEMENTS',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

alter table public.transactions
  alter column category type expense_category
  using (
    case upper(coalesce(category, ''))
      when 'RENT' then 'RENT'
      when 'SIM PLAN' then 'SIM_PLAN'
      when 'SIM_PLAN' then 'SIM_PLAN'
      when 'GROCERIES' then 'GROCERIES'
      when 'TRAVEL' then 'TRAVEL'
      when 'UTILITIES' then 'UTILITIES'
      when 'TRANSPORT' then 'TRANSPORT'
      when 'DINING' then 'DINING'
      when 'HEALTH' then 'HEALTH'
      when 'SHOPPING' then 'SHOPPING'
      when 'SUPPLEMENTS' then 'SUPPLEMENTS'
      else 'OTHER'
    end
  )::expense_category;

-- Category stays nullable at the column level (TRANSFER/DEPOSIT rows don't
-- need one), but is required for EXPENSE rows specifically — that's what
-- the category-based spending analysis on the wallet page depends on.
alter table public.transactions
  add constraint transactions_expense_requires_category
  check (type <> 'EXPENSE' or category is not null);
