import { createTransactionSchema } from '@expense-tracker/shared';
import type { z } from 'zod';

// currency не спрашиваем — всегда user.baseCurrency (решение 9 плана): сводка
// считает только базовую валюту, дай мы селектор валют — расход в другой валюте
// появился бы в ленте и отсутствовал в сводке, и это выглядело бы багом.
export const createTransactionFormSchema = createTransactionSchema.omit({ currency: true });

export type CreateTransactionFormValues = z.input<typeof createTransactionFormSchema>;
export type CreateTransactionFormData = z.output<typeof createTransactionFormSchema>;
