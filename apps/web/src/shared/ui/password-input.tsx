'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRef, useState, type ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { Input } from './input';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

function PasswordInput({ className, ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const innerRef = useRef<HTMLInputElement | null>(null);

  function setRefs(node: HTMLInputElement | null) {
    innerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }

  function toggleVisible() {
    const input = innerRef.current;
    const selectionStart = input?.selectionStart ?? null;
    const selectionEnd = input?.selectionEnd ?? null;

    setVisible((current) => !current);

    // type у input меняется через re-render — без ручного возврата фокуса
    // и каретки iOS закрывает клавиатуру.
    requestAnimationFrame(() => {
      input?.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        input?.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        onClick={toggleVisible}
        aria-pressed={visible}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
