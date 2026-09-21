import { Category, Currency, MonthlyStats, Payment, Subscription } from '../constants/types';
import { parseLocalDate } from './helpers';
import { getSubscriptionOccurrences } from './subscriptions';

export const calculateMonthlyStats = (
  payments: Payment[], subscriptions: Subscription[], categories: Category[],
  year: number, month: number, currency: Currency,
): MonthlyStats => {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthPayments = payments.filter(item => item.currency === currency && item.due_date.startsWith(prefix));
  const occurrences = getSubscriptionOccurrences(
    subscriptions.filter(item => item.currency === currency), new Date(year, month - 1, 1), new Date(year, month, 0),
  );
  const expenses = [
    ...monthPayments.map(item => ({ category: item.category, amount: item.amount, date: item.due_date })),
    ...occurrences.map(({ subscription, date }) => ({ category: 'Abonelik', amount: subscription.amount, date })),
  ];
  const catMap: Record<string, number> = {};
  for (const item of expenses) catMap[item.category] = (catMap[item.category] ?? 0) + item.amount;
  return {
    totalExpense: expenses.reduce((sum, item) => sum + item.amount, 0),
    subscriptionExpense: occurrences.reduce((sum, item) => sum + item.subscription.amount, 0),
    subscriptionCount: occurrences.length,
    paidCount: monthPayments.filter(item => item.status === 'paid').length,
    pendingCount: monthPayments.filter(item => item.status === 'pending').length,
    overdueCount: monthPayments.filter(item => item.status === 'overdue').length,
    categoryBreakdown: Object.entries(catMap).map(([category, amount]) => ({
      category, amount, color: categories.find(item => item.name === category)?.color ?? (category === 'Abonelik' ? '#6C63FF' : '#78909C'),
    })),
    weeklyData: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, index) => ({
      day, amount: expenses.filter(item => parseLocalDate(item.date)?.getDay() === (index + 1) % 7)
        .reduce((sum, item) => sum + item.amount, 0),
    })),
  };
};
