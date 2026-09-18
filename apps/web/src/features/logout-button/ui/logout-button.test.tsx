import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LogoutButton } from './logout-button';

describe('LogoutButton', () => {
  it('клик вызывает onLogout, во время выполнения кнопка заблокирована', async () => {
    let resolveLogout: () => void = () => {};
    const onLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LogoutButton onLogout={onLogout} />);

    const button = screen.getByRole('button', { name: /Выйти/ });
    await user.click(button);

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    resolveLogout();
  });
});
