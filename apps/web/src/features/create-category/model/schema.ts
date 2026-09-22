import { createCategorySchema } from '@expense-tracker/shared';
import type { z } from 'zod';

// icon не спрашиваем: без пикера иконок поле «введите utensils» — полуфабрикат,
// схема допускает null/undefined.
export const createCategoryFormSchema = createCategorySchema.pick({ name: true, color: true });

export type CreateCategoryFormValues = z.input<typeof createCategoryFormSchema>;
export type CreateCategoryFormData = z.output<typeof createCategoryFormSchema>;

/**
 * Свободный <input type="color"> позволил бы выбрать, например, тёмно-серый
 * на тёмном фоне — сетка предустановленных цветов гарантирует видимость метки.
 */
export const CATEGORY_COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
] as const;
