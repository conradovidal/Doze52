"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const { session, signOut } = useAuth();

  if (!session) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {session.user.email.split("@")[0]}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-neutral-500">Conectado como</p>
            <p className="truncate text-sm font-medium">{session.user.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut size={14} className="mr-2" />
            Sair
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
