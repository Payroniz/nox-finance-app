import { Currency, Subscription, SubscriptionInput } from '../constants/types';
import { formatLocalDateKey, parseLocalDate } from './helpers';

export const SUBSCRIPTION_CYCLES = { weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' };

export const validateSubscription = (item: SubscriptionInput): void => {
  const date = typeof item.renewal_date === 'string' ? parseLocalDate(item.renewal_date) : null;
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
    || !Number.isFinite(item.amount) || item.amount <= 0
    || !['TRY', 'USD', 'EUR', 'GBP'].includes(item.currency)
    || !['weekly', 'monthly', 'yearly'].includes(item.billing_cycle)
    || !date || formatLocalDateKey(date) !== item.renewal_date
    || ![0, 1].includes(item.active) || typeof item.notes !== 'string') {
    throw new Error('INVALID_SUBSCRIPTION');
  }
};

// Always calculate from the original billing date so 31 January does not drift to 28 March.
export const getNextRenewal = (item: Pick<Subscription, 'renewal_date' | 'billing_cycle'>, now = new Date()): string => {
  const anchor = parseLocalDate(item.renewal_date);
  if (!anchor) return item.renewal_date;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (anchor >= today) return formatLocalDateKey(anchor);
  if (item.billing_cycle === 'weekly') {
    const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / 86400000);
    anchor.setDate(anchor.getDate() + Math.ceil(days / 7) * 7);
    return formatLocalDateKey(anchor);
  }
  const step = item.billing_cycle === 'yearly' ? 12 : 1;
  const months = (today.getFullYear() - anchor.getFullYear()) * 12 + today.getMonth() - anchor.getMonth();
  let offset = Math.floor(months / step) * step;
  const occurrence = (count: number) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() + count, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(anchor.getDate(), lastDay));
    return date;
  };
  if (occurrence(offset) < today) offset += step;
  return formatLocalDateKey(occurrence(offset));
};

export const getMonthlySubscriptionTotals = (items: Subscription[]): Partial<Record<Currency, number>> => {
  const totals: Partial<Record<Currency, number>> = {};
  for (const item of items.filter(item => item.active === 1)) {
    const monthly = item.billing_cycle === 'yearly' ? item.amount / 12
      : item.billing_cycle === 'weekly' ? item.amount * 52 / 12 : item.amount;
    totals[item.currency] = (totals[item.currency] ?? 0) + monthly;
  }
  return totals;
};
