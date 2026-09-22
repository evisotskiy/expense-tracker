import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test/render-with-providers';

const { deleteTransactionMock } = vi.hoisted(() => ({ deleteTransactionMock: vi.fn() }));

vi.mock('@/entities/transaction', () => ({
  deleteTransaction: deleteTransactionMock,
  transactionKeys: { all: () => ['transactions'] },
}));

import { DeleteTransactionButton } from './delete-transaction-button';

describe('DeleteTransactionButton', () => {
  beforeEach(() => {
    deleteTransactionMock.mockReset();
  });

  it('подтверждение в AlertDialog вызывает удаление', async () => {
    deleteTransactionMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<DeleteTransactionButton transactionId="tx-1" />);

    await user.click(screen.getByRole('button', { name: 'Удалить транзакцию' }));
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteTransactionMock).toHaveBeenCalledWith('tx-1'));
  });

  it('отмена не вызывает удаление', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteTransactionButton transactionId="tx-1" />);

    await user.click(screen.getByRole('button', { name: 'Удалить транзакцию' }));
    await user.click(await screen.findByRole('button', { name: 'Отмена' }));

    expect(deleteTransactionMock).not.toHaveBeenCalled();
  });

  it('при ошибке удаления диалог остаётся открытым и показывает алерт', async () => {
    deleteTransactionMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<DeleteTransactionButton transactionId="tx-1" />);

    await user.click(screen.getByRole('button', { name: 'Удалить транзакцию' }));
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить транзакцию');
    // Диалог не закрылся — заголовок подтверждения всё ещё виден.
    expect(screen.getByText('Удалить транзакцию?')).toBeInTheDocument();
  });
});
