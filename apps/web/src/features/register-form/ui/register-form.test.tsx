import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('рендерит email, пароль и подтверждение пароля', () => {
    render(<RegisterForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
    expect(screen.getByLabelText('Повторите пароль')).toBeInTheDocument();
  });

  it('пароль без заглавной буквы показывает сообщение из passwordSchema shared', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    // 9 символов, есть цифра — единственное нарушение passwordSchema: нет заглавной.
    // Тот же текст может дополнительно показать индикатор надёжности как hint —
    // поэтому ищем все совпадения, а не одно.
    await user.type(screen.getByLabelText('Пароль'), 'abcdefgh1');
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Добавьте заглавную букву').length).toBeGreaterThan(0);
    });
  });

  it('пароль без цифры показывает сообщение из passwordSchema shared', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    // 8 символов, оба регистра — единственное нарушение passwordSchema: нет цифры.
    await user.type(screen.getByLabelText('Пароль'), 'Abcdefgh');
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Добавьте цифру').length).toBeGreaterThan(0);
    });
  });

  it('несовпадение паролей показывает ошибку на поле подтверждения', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'Secret123');
    await user.type(screen.getByLabelText('Повторите пароль'), 'Different123');
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    const message = await screen.findByText('Пароли не совпадают');
    expect(screen.getByLabelText('Повторите пароль')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(message.id),
    );
  });

  it('успешный сабмит передаёт только email и password, без confirmPassword', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'Secret123');
    await user.type(screen.getByLabelText('Повторите пароль'), 'Secret123');
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Secret123' });
  });

  it('«глаз» переключает видимость пароля и возвращается обратно', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    const password = screen.getByLabelText('Пароль');
    expect(password).toHaveAttribute('type', 'password');

    const toggles = screen.getAllByRole('button', { name: 'Показать пароль' });
    await user.click(toggles[0]!);

    expect(password).toHaveAttribute('type', 'text');
    const hideToggle = screen.getAllByRole('button', { name: 'Скрыть пароль' })[0]!;
    expect(hideToggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(hideToggle);
    expect(password).toHaveAttribute('type', 'password');
  });

  it('индикатор надёжности скрыт, пока пароль не введён', () => {
    render(<RegisterForm onSubmit={vi.fn()} />);
    expect(screen.queryByText('Добавьте цифру')).not.toBeInTheDocument();
  });

  it('индикатор надёжности меняет уровень при вводе и связан с полем через aria-describedby', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    const password = screen.getByLabelText('Пароль');
    await user.type(password, 'Abcdefghij12!');

    const status = await screen.findByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('Надёжный'));

    const describedBy = password.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain(status.closest('[id]')?.id);
  });
});
