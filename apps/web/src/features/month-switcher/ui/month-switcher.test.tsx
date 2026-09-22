import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { currentMonth, shiftMonth } from '@/shared/lib/date/month';

import { MonthSwitcher } from './month-switcher';

describe('MonthSwitcher', () => {
  it('показывает заголовок месяца', () => {
    render(<MonthSwitcher value={{ year: 2026, month: 9 }} onChange={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Сентябрь 2026' })).toBeInTheDocument();
  });

  it('«Назад» сдвигает месяц на -1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MonthSwitcher value={{ year: 2026, month: 1 }} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));

    expect(onChange).toHaveBeenCalledWith({ year: 2025, month: 12 });
  });

  it('«Вперёд» сдвигает месяц на +1, когда доступна', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const past = shiftMonth(currentMonth(), -2);
    render(<MonthSwitcher value={past} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));

    expect(onChange).toHaveBeenCalledWith(shiftMonth(past, 1));
  });

  it('«Вперёд» заблокирована на текущем месяце', () => {
    render(<MonthSwitcher value={currentMonth()} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Следующий месяц' })).toBeDisabled();
  });
});
