import { LogOut } from "lucide-react";

import { signOut } from "@/app/(app)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProfileRole } from "@/lib/types/database.types";

export function AppHeader({
  fullName,
  role,
}: {
  fullName: string;
  role: ProfileRole;
}) {
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3 backdrop-blur-lg">
      <div className="flex items-center gap-2">
        <span className="from-finance via-shift to-fitness flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white">
          VS
        </span>
        <span className="font-semibold tracking-tight">VibeSync</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
          <Badge variant={role === "OWNER" ? "shift" : "finance"}>
            {role === "OWNER" ? "Owner" : "Partner"}
          </Badge>
          <Avatar className="size-9">
            <AvatarFallback className="text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-sm font-medium">{fullName}</div>
          <form action={signOut}>
            <DropdownMenuItem asChild variant="destructive">
              <button type="submit" className="w-full">
                <LogOut />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
