-- Ledger-integrity pass. Everything here fixes a behavior that was verified
-- broken against a real database, or closes a hole that would silently
-- corrupt/destroy financial history.

-- ── 1. Transfers become one logical event ────────────────────────────────
-- A transfer has always been two ordinary signed rows (negative leg on the
-- source, positive leg on the destination) — but nothing linked them, so
-- there was no safe way to delete or reason about a transfer as a unit:
-- removing one leg would silently leave the other behind and put two
-- accounts permanently out of balance. This column is that link.
alter table public.transactions
  add column if not exists transfer_group_id uuid;

create index if not exists transactions_transfer_group_idx
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;

-- ── 2. Offline quick-add idempotency ─────────────────────────────────────
-- The offline queue (src/lib/offline-queue.ts) replays entries with a plain
-- fetch once connectivity returns. If a replayed request actually succeeded
-- but its *response* was lost (very normal on a flaky mobile connection),
-- the entry stays queued and posts a second time — a silent duplicate
-- expense. A client-generated id + this unique index makes the replay
-- genuinely idempotent instead: the retry hits the constraint and is
-- absorbed as a no-op rather than double-charging the ledger.
alter table public.transactions
  add column if not exists client_id text;

create unique index if not exists transactions_user_client_id_key
  on public.transactions (user_id, client_id)
  where client_id is not null;

-- ── 3. Editing an account's opening balance must resync its balance ──────
-- VERIFIED BUG: init_account_balance() only ran BEFORE INSERT, so updating
-- `starting_balance` left `current_balance` frozen at its old value forever
-- (confirmed live: start 100 -> 500 left current at 100). BEFORE UPDATE and
-- assigning to NEW in-place, rather than issuing a second UPDATE, so there
-- is no way for this to recurse.
create or replace function public.resync_balance_on_starting_change()
returns trigger
language plpgsql
as $$
begin
  if new.starting_balance is distinct from old.starting_balance then
    new.current_balance := new.starting_balance + coalesce(
      (select sum(amount) from public.transactions where account_id = new.id), 0
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_accounts_resync_balance on public.accounts;
create trigger trg_accounts_resync_balance
  before update on public.accounts
  for each row execute function public.resync_balance_on_starting_change();

-- ── 4. Deleting an account must not silently erase ledger history ────────
-- `transactions.account_id` is ON DELETE CASCADE, so a single DELETE on
-- accounts would take every transaction ever recorded against it with no
-- warning — including the surviving halves of transfers to *other*
-- accounts, whose balances would then be wrong. There is deliberately no
-- delete-account UI, but the RLS policy permits it, so this enforces the
-- intent at the only layer that can't be bypassed.
create or replace function public.prevent_account_delete_with_history()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.transactions where account_id = old.id) then
    raise exception
      'Account % still has transactions — delete or move them first (this guard exists so ledger history is never silently cascaded away)',
      old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_accounts_prevent_delete on public.accounts;
create trigger trg_accounts_prevent_delete
  before delete on public.accounts
  for each row execute function public.prevent_account_delete_with_history();

-- ── 5. Deleting a transaction, safely ────────────────────────────────────
-- There was no way at all to remove a mis-entered transaction, which for an
-- expense tracker means a typo'd amount is permanent. Doing it correctly
-- needs more than `delete from transactions`:
--   * a TRANSFER must delete BOTH legs or two accounts go out of balance
--   * a LOAN/REPAYMENT row is owned by loans/loan_repayments state — quietly
--     dropping it would leave `is_settled` and the repayment ledger lying,
--     so those are refused here and must go through the Loans page
-- SECURITY INVOKER: RLS decides whose rows are reachable, so a PARTNER can
-- only ever delete her own; is_owner() lets OWNER clean up either side.
create or replace function public.delete_transaction(p_transaction_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx public.transactions;
  v_deleted integer;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction % not found', p_transaction_id;
  end if;

  if v_tx.type in ('LOAN', 'REPAYMENT') then
    raise exception 'Loan transactions are managed from the Loans page, not deleted directly';
  end if;

  if v_tx.type = 'TRANSFER' then
    if v_tx.transfer_group_id is null then
      raise exception 'This transfer predates paired-leg tracking and cannot be safely auto-deleted';
    end if;
    delete from public.transactions where transfer_group_id = v_tx.transfer_group_id;
  else
    delete from public.transactions where id = p_transaction_id;
  end if;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.delete_transaction(uuid) to authenticated;
