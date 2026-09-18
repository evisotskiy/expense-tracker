'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/shared/ui/button';

interface LogoutButtonProps {
  /** Форма/кнопка не знает про навигацию и мутации — они живут в widgets. */
  onLogout: () => Promise<void>;
}

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleClick() {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isLoggingOut} aria-busy={isLoggingOut}>
      {isLoggingOut && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      Выйти
    </Button>
  );
}
