import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  it('открывает меню с полным email и пунктом «Выйти»', async () => {
    const user = userEvent.setup();
    render(<UserMenu email="user@example.com" onLogout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'user@example.com' }));

    expect(await screen.findByRole('menuitem', { name: /Выйти/ })).toBeInTheDocument();
  });

  it('клик по «Выйти» вызывает onLogout и блокирует пункт на время выполнения', async () => {
    let resolveLogout: () => void = () => {};
    const onLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<UserMenu email="user@example.com" onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: 'user@example.com' }));
    const item = await screen.findByRole('menuitem', { name: /Выйти/ });
    await user.click(item);

    expect(onLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(item).toHaveAttribute('data-disabled'));

    resolveLogout();
  });
});
