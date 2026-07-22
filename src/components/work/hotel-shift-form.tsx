"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { createHotelShift } from "@/app/(app)/work/actions";
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
  calculateHotelShiftPay,
  sumRoomCredits,
} from "@/lib/calculations/shift-pay";
import { formatCurrency, todayLocalISO } from "@/lib/format";
import type { RoomDetail } from "@/lib/types/database.types";

export function HotelShiftForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [shiftDate, setShiftDate] = useState(todayLocalISO());
  const [rooms, setRooms] = useState<RoomDetail[]>([{ room: "", credits: 1 }]);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) router.replace("/work");
  }

  function addRoom(credits: number) {
    setRooms((prev) => [...prev, { room: "", credits }]);
  }

  function updateRoom(index: number, patch: Partial<RoomDetail>) {
    setRooms((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function removeRoom(index: number) {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createHotelShift({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setRooms([{ room: "", credits: 1 }]);
      setShiftDate(todayLocalISO());
      handleOpenChange(false);
      router.refresh();
    });
  }

  const totalCredits = sumRoomCredits(rooms);
  const estimate = calculateHotelShiftPay(shiftDate, totalCredits);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="shift" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add hotel shift
      </Button>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log hotel shift</DialogTitle>
          <DialogDescription>
            Add each room and its credit weight — standard rooms are 1.0,
            VIP/deep-clean rooms are 1.5.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="shiftDate" value={shiftDate} />
          <input type="hidden" name="rooms" value={JSON.stringify(rooms)} />

          <div className="grid gap-2">
            <Label htmlFor="shift-date">Shift date</Label>
            <Input
              id="shift-date"
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              max={todayLocalISO()}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Rooms</Label>
            {rooms.map((room, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder={`Room ${index + 1}`}
                  value={room.room}
                  onChange={(e) => updateRoom(index, { room: e.target.value })}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={room.credits}
                  onChange={(e) =>
                    updateRoom(index, { credits: Number(e.target.value) || 0 })
                  }
                  className="w-20"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRoom(index)}
                  disabled={rooms.length === 1}
                  aria-label="Remove room"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRoom(1)}
              >
                <Plus className="size-3.5" />
                Standard (1.0)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRoom(1.5)}
              >
                <Plus className="size-3.5" />
                VIP (1.5)
              </Button>
            </div>
          </div>

          <div className="bg-shift/10 flex flex-col gap-1 rounded-xl p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total credits</span>
              <span className="font-medium">{totalCredits.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Day type / rate</span>
              <span className="font-medium">
                {estimate.dayOfWeek} · ${estimate.baseHourlyRate.toFixed(2)}/hr
              </span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">Estimated pay</span>
              <span className="text-shift font-semibold">
                {formatCurrency(estimate.calculatedPay, "AUD")}
              </span>
            </div>
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save shift
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
