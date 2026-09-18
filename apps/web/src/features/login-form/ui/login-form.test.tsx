import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/shared/api/api-client';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('рендерит поля с правильными атрибутами, находимые по label', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputMode', 'email');
    expect(email).toHaveAttribute('autoComplete', 'email');

    const password = screen.getByLabelText('Пароль');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autoComplete', 'current-password');
  });

  it('пустой сабмит показывает ошибки и не вызывает onSubmit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Некорректный email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ошибка появляется по blur до сабмита (onTouched)', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    const email = screen.getByLabelText('Email');
    await user.click(email);
    await user.tab();

    expect(await screen.findByText('Некорректный email')).toBeInTheDocument();
  });

  it('валидные данные вызывают onSubmit ровно один раз с нормализованным email', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), '  USER@Example.COM  ');
    await user.type(screen.getByLabelText('Пароль'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' });
  });

  it('поле с ошибкой имеет aria-invalid и aria-describedby на текст ошибки', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Войти' }));

    const email = await screen.findByLabelText('Email');
    const message = await screen.findByText('Некорректный email');

    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('во время отправки кнопка заблокирована и показывает "Входим…"', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    const button = await screen.findByRole('button', { name: /Входим…/ });
    expect(button).toBeDisabled();

    resolveSubmit();
  });

  it('реджект ApiRequestError(401) показывает общий алерт', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiRequestError(401, 'Неверный email или пароль'));
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Неверный email или пароль');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
  });

  it('два клика подряд вызывают onSubmit один раз', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'secret123');

    const button = screen.getByRole('button', { name: 'Войти' });
    await user.click(button);
    // К этому моменту кнопка уже disabled — второй клик не должен пройти.
    await user.click(button);

    resolveSubmit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
