import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Склеивает классы Tailwind и разрешает конфликты.
 *
 * clsx убирает falsy-значения, twMerge оставляет последний из конфликтующих классов:
 * cn('p-2', 'p-4') → 'p-4', а не 'p-2 p-4' с непредсказуемым победителем.
 * Этой функции ждёт shadcn/ui во всех своих компонентах.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
