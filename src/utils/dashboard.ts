import { Currency, Debt, Payment, Subscription } from '../constants/types';
import { formatLocalDateKey } from './helpers';
import { getSubscriptionOccurrences } from './subscriptions';

export interface DashboardEvent {
  id: string;
  entityId: number;
  kind: 'payment' | 'subscription' | 'debt';
  name: string;
  date: string;
  amount: number;
  currency: Currency;
  receivable: boolean;
  overdue: boolean;
  label: string;
}

export const buildDashboardEvents = (
  payments: Payment[], subscriptions: Subscription[], debts: Debt[], now = new Date(),
): DashboardEvent[] => {
  const today = formatLocalDateKey(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  const endKey = formatLocalDateKey(end);
  return [
    ...payments.filter(item => item.status !== 'paid' && item.due_date <= endKey).map(item => ({
      id: `payment-${item.id}`, entityId: item.id, kind: 'payment' as const, name: item.name, date: item.due_date,
      amount: item.amount, currency: item.currency, receivable: false, overdue: item.due_date < today, label: 'Ödeme',
    })),
    ...getSubscriptionOccurrences(subscriptions, now, end).map(({ id, date, subscription: item }) => ({
      id, entityId: item.id, kind: 'subscription' as const, name: item.name, date,
      amount: item.amount, currency: item.currency, receivable: false, overdue: false, label: 'Abonelik',
    })),
    ...debts.filter(item => item.due_date && item.due_date <= endKey && item.total_amount > item.paid_amount).map(item => ({
      id: `debt-${item.id}`, entityId: item.id, kind: 'debt' as const, name: item.person_name, date: item.due_date,
      amount: item.total_amount - item.paid_amount, currency: item.currency,
      receivable: item.debt_direction === 'owed', overdue: item.due_date < today,
      label: item.debt_direction === 'owed' ? 'Alacak' : 'Borç',
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
};

export const getDashboardSummary = (payments: Payment[], debts: Debt[], currency: Currency, now = new Date()) => {
  const month = formatLocalDateKey(now).slice(0, 7);
  const monthly = payments.filter(item => item.currency === currency && item.due_date.startsWith(month));
  const paid = monthly.filter(item => item.status === 'paid');
  const remaining = (direction: 'owe' | 'owed') => debts.filter(item => item.currency === currency && item.debt_direction === direction)
    .reduce((total, item) => total + Math.max(0, item.total_amount - item.paid_amount), 0);
  return {
    paidAmount: paid.reduce((total, item) => total + item.amount, 0),
    pendingAmount: monthly.filter(item => item.status !== 'paid').reduce((total, item) => total + item.amount, 0),
    paidCount: paid.length,
    paymentCount: monthly.length,
    owe: remaining('owe'),
    owed: remaining('owed'),
  };
};