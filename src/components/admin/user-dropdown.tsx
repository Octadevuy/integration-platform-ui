"use client"

import { ChevronDown, LogOut, User } from "lucide-react"
import { signOut, useSession } from "next-auth/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function initialsFor(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export function UserDropdown() {
  const { data: session } = useSession()

  const username = session?.user?.name ?? "-"
  const role = session?.role ?? "-"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-white outline-none hover:bg-white/15"
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-white/20 text-white">
            {initialsFor(username)}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-32 truncate text-sm font-medium">{username}</span>
        <ChevronDown className="size-3.5 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1.5 px-1.5 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <User className="size-3.5" />
              {username}
            </span>
            <Badge variant="outline" className="w-fit">
              {role}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
