'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRef, type ComponentPropsWithoutRef, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';

import { cn } from '@/shared/lib/cn';
import { applyApiErrors } from '@/shared/lib/form/apply-api-errors';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';

import {
  CATEGORY_COLOR_PRESETS,
  createCategoryFormSchema,
  type CreateCategoryFormData,
  type CreateCategoryFormValues,
} from '../model/schema';

const FIELD_NAMES = ['name', 'color'] as const;

interface ColorRadioGroupProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  value: string | undefined;
  onChange: (color: string) => void;
}

/**
 * WAI-ARIA radiogroup: стрелки двигают и фокус, и выбор одновременно (то же
 * поведение, что у нативного `<input type="radio">` в одной группе), а Tab
 * заходит в группу ровно на одной кнопке — выбранной (roving tabindex).
 * Без этого все десять кнопок стояли бы в общем tab-порядке страницы.
 *
 * `...rest` принимает и форвардит id/aria-describedby/aria-invalid — FormControl
 * (см. shared/ui/form.tsx) клонирует единственного ребёнка и домешивает эти
 * пропсы, ровно как для нативного `<input>` в остальных полях формы.
 */
function ColorRadioGroup({ value, onChange, className, ...rest }: ColorRadioGroupProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    const wrapped = (index + CATEGORY_COLOR_PRESETS.length) % CATEGORY_COLOR_PRESETS.length;
    const color = CATEGORY_COLOR_PRESETS[wrapped]!;
    onChange(color);
    buttonRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = CATEGORY_COLOR_PRESETS.findIndex((color) => color === value);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusAndSelect(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusAndSelect(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAndSelect(0);
        break;
      case 'End':
        event.preventDefault();
        focusAndSelect(CATEGORY_COLOR_PRESETS.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Цвет категории"
      className={cn('flex flex-wrap gap-2', className)}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {CATEGORY_COLOR_PRESETS.map((color, index) => (
        <button
          key={color}
          ref={(node) => {
            buttonRefs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          // Только выбранная кнопка в tab-порядке — остальные достаются стрелками.
          tabIndex={value === color ? 0 : -1}
          onClick={() => onChange(color)}
          className={cn(
            'size-8 rounded-full border-2 transition-transform',
            value === color ? 'scale-110 border-foreground' : 'border-transparent',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

interface CategoryFormProps {
  /** Форма не знает про навигацию и мутации — они живут в диалоге. */
  onSubmit: (values: CreateCategoryFormData) => Promise<void>;
}

export function CategoryForm({ onSubmit }: CategoryFormProps) {
  const form = useForm<CreateCategoryFormValues, undefined, CreateCategoryFormData>({
    resolver: zodResolver(createCategoryFormSchema),
    defaultValues: { name: '', color: CATEGORY_COLOR_PRESETS[0] },
    mode: 'onTouched',
  });

  async function handleSubmit(values: CreateCategoryFormData) {
    try {
      await onSubmit(values);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELD_NAMES, 'name');
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input {...field} autoFocus className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цвет</FormLabel>
              <FormControl>
                <ColorRadioGroup value={field.value} onChange={field.onChange} />
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
            'Создать категорию'
          )}
        </Button>
      </form>
    </Form>
  );
}
