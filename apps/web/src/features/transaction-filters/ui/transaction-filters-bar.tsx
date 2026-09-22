'use client';

import type { Transaction } from '@expense-tracker/shared';

import { useCategories } from '@/entities/category';
import { ColorDot } from '@/shared/ui/color-dot';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

/** Суффикс Bar — иначе имя столкнётся с типом TransactionFilters из shared. */
export interface TransactionFiltersValue {
  type?: Transaction['type'];
  categoryId?: string;
}

interface TransactionFiltersBarProps {
  value: TransactionFiltersValue;
  onChange: (value: TransactionFiltersValue) => void;
}

// Radix Select.Item не принимает value="" — рантайм-ошибка, не типовая.
// «Все» кодируем сентинелом и разбираем его обратно в undefined на выходе.
const ALL_VALUE = 'ALL';

export function TransactionFiltersBar({ value, onChange }: TransactionFiltersBarProps) {
  const { data: categories, isError: isCategoriesError } = useCategories();

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={value.type ?? ALL_VALUE}
        onValueChange={(next) =>
          onChange({
            ...value,
            type: next === ALL_VALUE ? undefined : (next as Transaction['type']),
          })
        }
      >
        <SelectTrigger aria-label="Тип операции" className="w-36">
          <SelectValue placeholder="Тип" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Все типы</SelectItem>
          <SelectItem value="EXPENSE">Расходы</SelectItem>
          <SelectItem value="INCOME">Доходы</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={value.categoryId ?? ALL_VALUE}
        // Список категорий не загрузился — блокируем выбор, а не молча показываем
        // селект с одним пунктом «Все категории»: иначе выглядит как «категорий нет».
        disabled={isCategoriesError}
        onValueChange={(next) =>
          onChange({ ...value, categoryId: next === ALL_VALUE ? undefined : next })
        }
      >
        <SelectTrigger aria-label="Категория" className="w-44">
          <SelectValue placeholder={isCategoriesError ? 'Ошибка загрузки' : 'Категория'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Все категории</SelectItem>
          {categories?.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span className="flex items-center gap-2">
                <ColorDot color={category.color} />
                {category.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
