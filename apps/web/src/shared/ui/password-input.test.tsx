import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('переключает type, aria-pressed и aria-label по клику на «глаз»', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Пароль" />);

    const input = screen.getByLabelText('Пароль');
    expect(input).toHaveAttribute('type', 'password');

    const showButton = screen.getByRole('button', { name: 'Показать пароль' });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(showButton);

    expect(input).toHaveAttribute('type', 'text');
    const hideButton = screen.getByRole('button', { name: 'Скрыть пароль' });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(hideButton);

    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Показать пароль' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
