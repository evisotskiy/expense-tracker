'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@expense-tracker/shared';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { ApiRequestError } from '@/shared/api/api-client';
import { applyApiErrors } from '@/shared/lib/form/apply-api-errors';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { ColorDot } from '@/shared/ui/color-dot';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

import {
  createTransactionFormSchema,
  type CreateTransactionFormData,
  type CreateTransactionFormValues,
} from '../model/schema';

const FIELD_NAMES = ['type', 'amount', 'categoryId', 'date', 'description'] as const;

/**
 * Локальная дата, не UTC: это граница для <input type="date"> — календаря,
 * который пользователь читает в своей зоне. UTC здесь дал бы дыру в UTC+X:
 * с полуночи до X часов утра по местному времени new Date().toISOString()
 * всё ещё показывает вчерашний UTC-день, и max блокировал бы реальное
 * «сегодня» в самом календаре — хотя schema (isoDateSchema + запас 24 часа
 * в transactionDateSchema) такую дату приняла бы. Границы хранения остаются
 * в UTC — см. shared/lib/date/month.ts, здесь речь только про то, что видит
 * пользователь в пикере.
 */
function todayDateInputValue(): string {
  const now = new Date();
  const localMidnightUtc = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localMidnightUtc.toISOString().slice(0, 10);
}

interface TransactionFormProps {
  categories: Category[];
  /** Форма не знает про навигацию и мутации — они живут в диалоге. */
  onSubmit: (values: CreateTransactionFormData) => Promise<void>;
}

export function TransactionForm({ categories, onSubmit }: TransactionFormProps) {
  const today = todayDateInputValue();

  const form = useForm<CreateTransactionFormValues, undefined, CreateTransactionFormData>({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues: {
      type: 'EXPENSE',
      amount: '',
      categoryId: categories[0]?.id ?? '',
      date: today,
      description: '',
    },
    mode: 'onTouched',
  });

  async function handleSubmit(values: CreateTransactionFormData) {
    try {
      await onSubmit(values);
    } catch (error) {
      // 400 «Категория архивирована» приходит без errors-карты — сажаем вручную
      // на categoryId, а не в общий алерт: пользователь успел заархивировать
      // категорию в другой вкладке между открытием формы и отправкой.
      if (error instanceof ApiRequestError && error.statusCode === 400 && !error.errors) {
        form.setError('categoryId', { message: error.message }, { shouldFocus: true });
        return;
      }

      const message = applyApiErrors(error, form.setError, FIELD_NAMES);
      if (message) {
        form.setError('root', { message });
      }
    }
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        {errors.root?.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тип</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="EXPENSE">Расход</SelectItem>
                  <SelectItem value="INCOME">Доход</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма</FormLabel>
              <FormControl>
                <Input {...field} inputMode="decimal" placeholder="0,00" className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Категория</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <ColorDot color={category.color} />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дата</FormLabel>
              <FormControl>
                <Input {...field} type="date" max={today} className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ''} maxLength={500} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Сохраняем…
            </>
          ) : (
            'Добавить'
          )}
        </Button>
      </form>
    </Form>
  );
}
