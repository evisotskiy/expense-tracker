'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

interface UserMenuProps {
  email: string;
  /** Меню не знает про навигацию и мутации — они живут в widgets. */
  onLogout: () => Promise<void>;
}

export function UserMenu({ email, onLogout }: UserMenuProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* max-w-48 — иначе длинный email разносит шапку на телефоне. truncate — на
            внутреннем span, а не на самой Button: Button это inline-flex justify-center,
            и truncate прямо на нём центрирует переполнение и обрезает текст с двух
            сторон вместо аккуратного многоточия в конце. */}
        <Button variant="ghost" className="max-w-48">
          <span className="min-w-0 truncate">{email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={(event) => {
            // preventDefault — иначе Radix закрывает меню сразу же, и пункт
            // не успевает показать состояние disabled на время выхода.
            event.preventDefault();
            void handleLogout();
          }}
        >
          <LogOut aria-hidden="true" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
