// Hand-written to match supabase/migrations/*.sql exactly. Once the project
// is linked to a real Supabase project, this can be regenerated with:
//   npx supabase gen types typescript --project-id <id> > src/lib/types/database.types.ts
//
// `Relationships: []` on every table is required by @supabase/postgrest-js's
// GenericTable shape even though we don't use typed embedded-resource joins
// here — omitting it silently degrades that table's Insert/Update/Row types
// to `never`, which is caught at compile time (see the tsc error it produces)
// rather than failing silently at runtime.

export type ProfileRole = "ADMIN" | "PARTNER";
export type AccountType = "DIGITAL_WALLET" | "BANK" | "CASH";
export type TransactionType = "EXPENSE" | "DEPOSIT" | "TRANSFER";
export type DayOfWeekType = "WEEKDAY" | "SATURDAY" | "SUNDAY";
export type PayoutStatusType = "PENDING" | "PAID";

export type RoomDetail = {
  room: string;
  credits: number;
};

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
          category: string | null;
          merchant_or_item: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          amount: number;
          type: TransactionType;
          category?: string | null;
          merchant_or_item?: string | null;
          transaction_date?: string;
        };
        Update: Partial<{
          account_id: string;
          amount: number;
          type: TransactionType;
          category: string | null;
          merchant_or_item: string | null;
          transaction_date: string;
        }>;
        Relationships: [];
      };
      gym_exercises: {
        Row: {
          id: string;
          name: string;
          target_muscle: string | null;
          machine_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          target_muscle?: string | null;
          machine_name?: string | null;
        };
        Update: Partial<{
          name: string;
          target_muscle: string | null;
          machine_name: string | null;
        }>;
        Relationships: [];
      };
      gym_logs: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          weight_kg: number;
          reps: number;
          sets: number;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          weight_kg: number;
          reps: number;
          sets: number;
          logged_at?: string;
        };
        Update: Partial<{
          exercise_id: string;
          weight_kg: number;
          reps: number;
          sets: number;
          logged_at: string;
        }>;
        Relationships: [];
      };
      hotel_shifts: {
        Row: {
          id: string;
          user_id: string;
          shift_date: string;
          day_of_week: DayOfWeekType;
          rooms_cleaned: number;
          total_credits: number;
          base_hourly_rate: number;
          calculated_pay: number;
          room_details: RoomDetail[] | null;
          payout_status: PayoutStatusType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shift_date: string;
          rooms_cleaned?: number;
          total_credits: number;
          room_details?: RoomDetail[] | null;
          payout_status?: PayoutStatusType;
        };
        Update: Partial<{
          shift_date: string;
          rooms_cleaned: number;
          total_credits: number;
          room_details: RoomDetail[] | null;
          payout_status: PayoutStatusType;
        }>;
        Relationships: [];
      };
      secondary_shifts: {
        Row: {
          id: string;
          user_id: string;
          shift_date: string;
          hours_worked: number;
          hourly_rate: number;
          calculated_pay: number;
          payout_status: PayoutStatusType;
          payout_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shift_date: string;
          hours_worked?: number;
          hourly_rate?: number;
          payout_status?: PayoutStatusType;
          payout_batch_id?: string | null;
        };
        Update: Partial<{
          shift_date: string;
          hours_worked: number;
          hourly_rate: number;
          payout_status: PayoutStatusType;
          payout_batch_id: string | null;
        }>;
        Relationships: [];
      };
      payout_batches: {
        Row: {
          id: string;
          user_id: string;
          paid_at: string;
          total_amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      profile_role: ProfileRole;
      account_type: AccountType;
      transaction_type: TransactionType;
      day_of_week_type: DayOfWeekType;
      payout_status_type: PayoutStatusType;
    };
  };
};
