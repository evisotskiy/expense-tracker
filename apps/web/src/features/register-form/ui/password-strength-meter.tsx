'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { getPasswordStrength } from '../lib/password-strength';

interface PasswordStrengthMeterProps {
  password: string;
}

const SEGMENT_COUNT = 4;

const SEGMENT_COLOR: Record<number, string> = {
  0: 'bg-destructive',
  1: 'bg-destructive',
  2: 'bg-amber-500',
  3: 'bg-primary',
  4: 'bg-primary',
};

/**
 * Рендерится внутри <FormDescription> — её id автоматически попадает в
 * aria-describedby поля пароля, отдельно проставлять не нужно.
 */
export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(password);
  const previousScoreRef = useRef<number | null>(null);
  const [announcedLabel, setAnnouncedLabel] = useState<string | null>(null);

  useEffect(() => {
    const score = strength?.score ?? null;
    // Анонсируем только при смене уровня — иначе aria-live тараторит на
    // каждый символ, потому что hint меняется чаще, чем score.
    if (score !== previousScoreRef.current) {
      previousScoreRef.current = score;
      setAnnouncedLabel(strength?.label ?? null);
    }
  }, [strength?.score, strength?.label]);

  if (!strength) {
    return null;
  }

  // Только span: этот компонент рендерится внутри <FormDescription>, а она —
  // это <p>. Вложенный <div> внутри <p> — невалидный HTML, браузер закроет
  // <p> раньше времени, и aria-describedby перестанет видеть текст подсказки.
  return (
    <span className="block space-y-1.5">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              'block h-1 flex-1 rounded-full',
              index < strength.score ? SEGMENT_COLOR[strength.score] : 'bg-muted',
            )}
          />
        ))}
      </span>
      <span className="block text-xs text-muted-foreground">{strength.hint ?? strength.label}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcedLabel}
      </span>
    </span>
  );
}
