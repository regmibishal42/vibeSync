// Hand-written to match supabase/migrations/*.sql exactly. Once the project
// is linked to a real Supabase project, this can be regenerated with:
//   npx supabase gen types typescript --project-id <id> > src/lib/types/database.types.ts
//
// `Relationships: []` on every table is required by @supabase/postgrest-js's
// GenericTable shape even though we don't use typed embedded-resource joins
// here — omitting it silently degrades that table's Insert/Update/Row types
// to `never`, which is caught at compile time (see the tsc error it produces)
// rather than failing silently at runtime.

export type ProfileRole = "OWNER" | "PARTNER";
export type AccountType = "DIGITAL_WALLET" | "BANK" | "CASH";
export type TransactionType = "EXPENSE" | "DEPOSIT" | "TRANSFER" | "LOAN" | "REPAYMENT";
export type PayoutStatusType = "PENDING" | "PAID";
export type EmploymentType = "FULL_TIME" | "PART_TIME";
export type PayType = "HOURLY" | "MONTHLY" | "BIWEEKLY";
export type RecurringDirection = "INCOME" | "EXPENSE";
export type LoanDirection = "LENT" | "BORROWED";
export type ExpenseCategory =
  | "RENT"
  | "TRAVEL"
  | "PHONE_BILL"
  | "GROCERIES"
  | "SHOPPING"
  | "ENTERTAINMENT"
  | "SUBSCRIPTIONS"
  | "FUEL"
  | "INVESTMENT"
  | "OTHER";
export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
          full_name: string;
          currency_preference: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: ProfileRole;
          full_name: string;
          currency_preference?: string;
        };
        Update: Partial<{
          full_name: string;
          currency_preference: string;
        }>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          account_name: string;
          account_type: AccountType;
          is_parent_account: boolean;
          starting_balance: number;
          current_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_name: string;
          account_type: AccountType;
          is_parent_account?: boolean;
          starting_balance?: number;
        };
        Update: Partial<{
          account_name: string;
          account_type: AccountType;
          is_parent_account: boolean;
          starting_balance: number;
        }>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          amount: number;
          type: TransactionType;
          category: ExpenseCategory | null;
          merchant_or_item: string | null;
          transaction_date: string;
          loan_id: string | null;
          job_id: string | null;
          transfer_group_id: string | null;
          client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          amount: number;
          type: TransactionType;
          category?: ExpenseCategory | null;
          merchant_or_item?: string | null;
          transaction_date?: string;
          loan_id?: string | null;
          job_id?: string | null;
          transfer_group_id?: string | null;
          client_id?: string | null;
        };
        Update: Partial<{
          account_id: string;
          amount: number;
          type: TransactionType;
          category: ExpenseCategory | null;
          merchant_or_item: string | null;
          transaction_date: string;
        }>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          employment_type: EmploymentType;
          pay_type: PayType;
          hourly_rate: number | null;
          deposit_account_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          employment_type: EmploymentType;
          pay_type: PayType;
          hourly_rate?: number | null;
          deposit_account_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          name: string;
          employment_type: EmploymentType;
          pay_type: PayType;
          hourly_rate: number | null;
          deposit_account_id: string | null;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      job_shifts: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          shift_date: string;
          hours_worked: number;
          calculated_pay: number;
          payout_status: PayoutStatusType;
          payout_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          shift_date: string;
          hours_worked: number;
          payout_status?: PayoutStatusType;
          payout_batch_id?: string | null;
        };
        Update: Partial<{
          shift_date: string;
          hours_worked: number;
          payout_status: PayoutStatusType;
          payout_batch_id: string | null;
        }>;
        Relationships: [];
      };
      payout_batches: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          paid_at: string;
          total_amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          paid_at?: string;
          total_amount?: number;
          note?: string | null;
        };
        Update: Partial<{
          paid_at: string;
          total_amount: number;
          note: string | null;
        }>;
        Relationships: [];
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          job_id: string | null;
          direction: RecurringDirection;
          label: string;
          category: ExpenseCategory | null;
          amount: number;
          frequency: RecurringFrequency;
          next_due_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          job_id?: string | null;
          direction?: RecurringDirection;
          label: string;
          category?: ExpenseCategory | null;
          amount: number;
          frequency: RecurringFrequency;
          next_due_date: string;
          is_active?: boolean;
        };
        Update: Partial<{
          account_id: string;
          job_id: string | null;
          direction: RecurringDirection;
          label: string;
          category: ExpenseCategory | null;
          amount: number;
          frequency: RecurringFrequency;
          next_due_date: string;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      loans: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          counterparty_name: string;
          direction: LoanDirection;
          principal_amount: number;
          loan_date: string;
          due_date: string | null;
          notes: string | null;
          is_settled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          counterparty_name: string;
          direction: LoanDirection;
          principal_amount: number;
          loan_date?: string;
          due_date?: string | null;
          notes?: string | null;
          is_settled?: boolean;
        };
        Update: Partial<{
          counterparty_name: string;
          due_date: string | null;
          notes: string | null;
          is_settled: boolean;
        }>;
        Relationships: [];
      };
      loan_repayments: {
        Row: {
          id: string;
          loan_id: string;
          user_id: string;
          amount: number;
          paid_date: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          loan_id: string;
          user_id: string;
          amount: number;
          paid_date?: string;
          transaction_id?: string | null;
        };
        Update: Partial<{
          amount: number;
          paid_date: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      loan_balances: {
        Row: {
          user_id: string;
          counterparty_name: string;
          net_outstanding: number;
          has_open_loans: boolean;
          latest_due_date: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      mark_recurring_transaction_paid: {
        Args: { p_recurring_id: string; p_paid_date?: string };
        Returns: Database["public"]["Tables"]["transactions"]["Row"];
      };
      settle_job_shifts: {
        Args: { p_job_id: string; p_paid_date?: string; p_note?: string | null };
        Returns: Database["public"]["Tables"]["payout_batches"]["Row"];
      };
      create_loan: {
        Args: {
          p_account_id: string;
          p_counterparty_name: string;
          p_direction: LoanDirection;
          p_principal_amount: number;
          p_loan_date?: string;
          p_due_date?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["loans"]["Row"];
      };
      delete_transaction: {
        Args: { p_transaction_id: string };
        Returns: number;
      };
      repay_loan: {
        Args: {
          p_loan_id: string;
          p_amount: number;
          p_paid_date?: string;
          p_account_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["loans"]["Row"];
      };
    };
    Enums: {
      profile_role: ProfileRole;
      account_type: AccountType;
      transaction_type: TransactionType;
      payout_status_type: PayoutStatusType;
      employment_type: EmploymentType;
      pay_type: PayType;
      recurring_direction: RecurringDirection;
      loan_direction: LoanDirection;
      expense_category: ExpenseCategory;
      recurring_frequency: RecurringFrequency;
    };
  };
};
