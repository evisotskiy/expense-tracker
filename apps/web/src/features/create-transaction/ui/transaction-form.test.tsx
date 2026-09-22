import type { Category } from '@expense-tracker/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/shared/api/api-client';

import { TransactionForm } from './transaction-form';

// Идентификаторы должны проходить idSchema (z.cuid()) — форма валидирует categoryId
// как настоящий cuid, «cat-1» отклонился бы ещё до сабмита.
const CATEGORIES: Category[] = [
  {
    id: 'c000000000000000000000001',
    name: 'Еда',
    icon: null,
    color: '#ff0000',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'c000000000000000000000002',
    name: 'Транспорт',
    icon: null,
    color: '#00ff00',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

describe('TransactionForm', () => {
  it('рендерит поля типа (по умолчанию «Расход»), суммы, категории, даты и описания', () => {
    render(<TransactionForm categories={CATEGORIES} onSubmit={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Тип' })).toHaveTextContent('Расход');
    expect(screen.getByLabelText('Сумма')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Категория' })).toBeInTheDocument();
    expect(screen.getByLabelText('Дата')).toBeInTheDocument();
    expect(screen.getByLabelText('Описание')).toBeInTheDocument();
  });

  it('дата по умолчанию — сегодня, атрибут max тоже сегодня', () => {
    render(<TransactionForm categories={CATEGORIES} onSubmit={vi.fn()} />);

    const today = new Date().toISOString().slice(0, 10);
    const dateInput = screen.getByLabelText('Дата');
    expect(dateInput).toHaveValue(today);
    expect(dateInput).toHaveAttribute('max', today);
  });

  it('нулевая сумма показывает сообщение из moneyInputSchema shared', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TransactionForm categories={CATEGORIES} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Сумма'), '0');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    await screen.findByText('Сумма должна быть больше нуля');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('успешный сабмит нормализует сумму с запятой и передаёт выбранную категорию', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TransactionForm categories={CATEGORIES} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Сумма'), '1234,56');

    await user.click(screen.getByRole('combobox', { name: 'Категория' }));
    await user.click(await screen.findByRole('option', { name: /Транспорт/ }));

    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]![0];
    expect(submitted.amount).toBe('1234.56');
    expect(submitted.categoryId).toBe('c000000000000000000000002');
    expect(submitted.type).toBe('EXPENSE');
  });

  it('400 без карты ошибок сажает сообщение на поле категории', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(400, 'Категория архивирована — выберите другую'));
    const user = userEvent.setup();
    render(<TransactionForm categories={CATEGORIES} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Сумма'), '100');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    const message = await screen.findByText('Категория архивирована — выберите другую');
    expect(screen.getByRole('combobox', { name: 'Категория' })).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(message.id),
    );
  });
});
