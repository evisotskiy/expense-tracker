import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CATEGORY_COLOR_PRESETS } from '../model/schema';
import { CategoryForm } from './category-form';

describe('CategoryForm', () => {
  it('рендерит поле названия и 10 предустановленных цветов, первый выбран по умолчанию', () => {
    render(<CategoryForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Название')).toBeInTheDocument();
    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(CATEGORY_COLOR_PRESETS.length);
    expect(swatches[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('пустое название блокирует сабмит', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<CategoryForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Создать категорию' }));

    await screen.findByText('Укажите название');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('клик по цвету переключает выбранный радиокнопку', async () => {
    const user = userEvent.setup();
    render(<CategoryForm onSubmit={vi.fn()} />);

    const swatches = screen.getAllByRole('radio');
    await user.click(swatches[2]!);

    expect(swatches[2]).toHaveAttribute('aria-checked', 'true');
    expect(swatches[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('roving tabindex: в tab-порядке только выбранная кнопка, стрелки переключают выбор', async () => {
    const user = userEvent.setup();
    render(<CategoryForm onSubmit={vi.fn()} />);

    const swatches = screen.getAllByRole('radio');
    expect(swatches[0]).toHaveAttribute('tabindex', '0');
    expect(swatches[1]).toHaveAttribute('tabindex', '-1');

    swatches[0]!.focus();
    await user.keyboard('{ArrowRight}');

    expect(swatches[1]).toHaveAttribute('aria-checked', 'true');
    expect(swatches[1]).toHaveAttribute('tabindex', '0');
    expect(swatches[0]).toHaveAttribute('tabindex', '-1');
    expect(swatches[1]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(swatches[0]).toHaveAttribute('aria-checked', 'true');
    expect(swatches[0]).toHaveFocus();
  });

  it('успешный сабмит передаёт название и выбранный цвет', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Название'), 'Еда');
    await user.click(screen.getAllByRole('radio')[1]!);
    await user.click(screen.getByRole('button', { name: 'Создать категорию' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Еда', color: CATEGORY_COLOR_PRESETS[1] });
  });

  it('409 от API подсвечивает поле названия', async () => {
    const { ApiRequestError } = await import('@/shared/api/api-client');
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(409, 'Категория с таким названием уже есть'));
    const user = userEvent.setup();
    render(<CategoryForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Название'), 'Еда');
    await user.click(screen.getByRole('button', { name: 'Создать категорию' }));

    const message = await screen.findByText('Категория с таким названием уже есть');
    expect(screen.getByLabelText('Название')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(message.id),
    );
  });
});
