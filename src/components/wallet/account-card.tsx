import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL } from "@/lib/wallet/account-type";
import type { Database } from "@/lib/types/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function AccountCard({
  account,
  currency,
}: {
  account: Account;
  currency: string;
}) {
  const Icon = ACCOUNT_TYPE_ICON[account.account_type];

  return (
    <Card className="gap-3 py-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="bg-finance/15 text-finance flex size-10 items-center justify-center rounded-xl">
            <Icon className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="font-medium">{account.account_name}</span>
            <span className="text-muted-foreground text-xs">
              {ACCOUNT_TYPE_LABEL[account.account_type]}
              {account.is_parent_account ? " · Parent" : ""}
            </span>
          </div>
        </div>
        {account.is_parent_account ? (
          <Badge variant="finance">Parent</Badge>
        ) : null}
      </div>
      <div className="px-4">
        <span className="text-2xl font-semibold">
          {formatCurrency(account.current_balance, currency)}
        </span>
      </div>
    </Card>
  );
}
