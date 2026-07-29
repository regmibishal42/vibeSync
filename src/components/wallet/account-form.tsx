"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createAccount } from "@/app/(app)/wallet/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AccountForm({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState("DIGITAL_WALLET");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createAccount({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add account
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            A wallet, bank account, or cash stash to track.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="accountType" value={accountType} />

          <div className="grid gap-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              name="accountName"
              placeholder="Khalti, Nabil Bank, Sydney Commonwealth…"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Account type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIGITAL_WALLET">Digital wallet</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="starting-balance">Starting balance</Label>
            <Input
              id="starting-balance"
              name="startingBalance"
              type="number"
              step="0.01"
              defaultValue={0}
            />
          </div>

          {isOwner ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isParentAccount" className="size-4" />
              This is a parent&apos;s account
            </label>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
