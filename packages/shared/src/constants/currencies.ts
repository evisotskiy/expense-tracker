/** Валюты, которые приложение показывает в селекторах. ISO 4217. */
export const SUPPORTED_CURRENCIES = ['RUB', 'USD', 'EUR', 'GBP', 'KZT', 'UAH'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'RUB';

/** Сколько знаков после запятой у валюты (JPY, например, не имеет дробной части). */
export const CURRENCY_FRACTION_DIGITS: Record<SupportedCurrency, number> = {
  RUB: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  KZT: 2,
  UAH: 2,
};
