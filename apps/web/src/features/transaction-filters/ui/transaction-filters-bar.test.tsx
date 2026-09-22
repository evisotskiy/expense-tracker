import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransactionFiltersBar } from './transaction-filters-bar';

vi.mock('@/entities/category', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-1', name: 'Еда', color: '#ff0000', icon: null, isArchived: false },
      { id: 'cat-2', name: 'Транспорт', color: '#00ff00', icon: null, isArchived: false },
    ],
  }),
}));

describe('TransactionFiltersBar', () => {
  it('выбор конкретного типа отдаёт его наружу', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TransactionFiltersBar value={{}} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Тип операции' }));
    await user.click(await screen.findByRole('option', { name: 'Доходы' }));

    expect(onChange).toHaveBeenCalledWith({ type: 'INCOME' });
  });

  it('выбор «Все типы» отдаёт наружу undefined', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TransactionFiltersBar value={{ type: 'EXPENSE' }} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Тип операции' }));
    await user.click(await screen.findByRole('option', { name: 'Все типы' }));

    expect(onChange).toHaveBeenCalledWith({ type: undefined });
  });

  it('выбор категории отдаёт её id, сохраняя остальные фильтры', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TransactionFiltersBar value={{ type: 'EXPENSE' }} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Категория' }));
    await user.click(await screen.findByRole('option', { name: 'Еда' }));

    expect(onChange).toHaveBeenCalledWith({ type: 'EXPENSE', categoryId: 'cat-1' });
  });
});
