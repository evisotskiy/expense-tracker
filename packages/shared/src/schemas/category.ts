import { z } from 'zod';

import { idSchema } from './common';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет задаётся в формате #rrggbb');

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(50),
  icon: z.string().trim().max(50).optional(),
  color: hexColorSchema.optional(),
});

/** Частичное обновление: PATCH, а не PUT — на форме редактируются отдельные поля. */
export const updateCategorySchema = createCategorySchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type Category = z.infer<typeof categorySchema>;
