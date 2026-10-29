import { Currency, Debt, Payment, SalaryAllocation, SalaryData, SalaryPeriod, SalaryWorkEntry, Subscription } from '../constants/types';
import { formatLocalDateKey, parseLocalDate } from './helpers';
import { getSubscriptionOccurrences } from './subscriptions';

export const MAX_SALARY_MONEY = 99_999_999_999;
export const SALARY_CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];
export const EMPTY_SALARY_DATA: SalaryData = { periods: [], workEntries: [], allocations: [] };

const requireValue = (condition: boolean, message: string): void => { if (!condition) throw new Error(message); };
const validMoney = (value: number, allowZero = false) => Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_SALARY_MONEY;
const validId = (value: number) => Number.isSafeInteger(value) && value > 0;
export const isSalaryMonth = (value: string): boolean => typeof value === 'string' && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
export const isSalaryDate = (value: string): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isSalaryMonth(value.slice(0, 7))) return false;
  const date = parseLocalDate(value);
  return !!date && formatLocalDateKey(date) === value;
};

export function parseSalaryMoney(value: string, allowZero = false): number {
  const input = value.trim();
  requireValue(/^\d{1,9}([.,]\d{1,2})?$/.test(input), 'Tutarı en fazla iki ondalık basamakla girin (ör. 150,50). Binlik ayırıcı kullanmayın.');
  const [whole, fraction = ''] = input.replace(',', '.').split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  requireValue(validMoney(minor, allowZero), allowZero ? 'Geçerli bir tutar girin.' : 'Tutar sıfırdan büyük olmalı.');
  return minor;
}

export function expenseToMinor(value: number): number {
  requireValue(Number.isFinite(value) && value >= 0 && value <= MAX_SALARY_MONEY / 100, 'Gider tutarı desteklenen aralığın dışında.');
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = BigInt(whole + fraction);
  const scale = 2 + Number(exponent) - fraction.length;
  const divisor = scale < 0 ? 10n ** BigInt(-scale) : 1n;
  const result = scale >= 0 ? digits * 10n ** BigInt(scale) : (digits + divisor / 2n) / divisor;
  const minor = Number(result);
  requireValue(validMoney(minor, true), 'Gider tutarı desteklenen aralığın dışında.');
  return minor;
}

export const salaryMoneyInput = (minor: number): string => `${Math.floor(minor / 100)},${String(minor % 100).padStart(2, '0')}`;
export const formatWorkDuration = (minutes: number): string => `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
export function parseWorkDuration(hours: string, minutes: string): number {
  requireValue(/^\d{1,2}$/.test(hours) && /^\d{1,2}$/.test(minutes), 'Saat ve dakikayı tam sayı olarak girin.');
  const total = Number(hours) * 60 + Number(minutes);
  requireValue(Number(minutes) < 60 && total > 0 && total <= 1440, 'Çalışma süresi 1 dakika ile 24 saat arasında olmalı. Dakika 0–59 arasında olmalı.');
  return total;
}

export function validateSalaryPeriod(item: Omit<SalaryPeriod, 'id'>): void {
  requireValue(!!item && isSalaryMonth(item.month) && SALARY_CURRENCIES.includes(item.currency)
    && ['hourly', 'monthly'].includes(item.mode) && validMoney(item.hourly_rate_minor, true)
    && validMoney(item.monthly_salary_minor, true), 'Maaş dönemi bilgileri geçersiz.');
  requireValue(item.mode === 'hourly' ? item.hourly_rate_minor > 0 : item.monthly_salary_minor > 0, 'Ücret sıfırdan büyük olmalı.');
}

export function validateSalaryWorkEntry(item: Omit<SalaryWorkEntry, 'id'>, period: SalaryPeriod, today?: string): void {
  requireValue(!!item && item.period_id === period.id && isSalaryDate(item.date) && item.date.slice(0, 7) === period.month,
    'Çalışma tarihi seçili ayın içinde olmalı.');
  if (today) requireValue(item.date <= today, 'Gelecekteki bir güne çalışılmış saat eklenemez.');
  requireValue(Number.isInteger(item.worked_minutes) && item.worked_minutes >= 1 && item.worked_minutes <= 1440
    && Number.isInteger(item.break_minutes) && item.break_minutes >= 0 && item.break_minutes < item.worked_minutes,
  'Mola, toplam çalışma süresinden kısa olmalı. Günlük süre en fazla 24 saat olabilir.');
  requireValue(validMoney(item.hourly_rate_minor) && typeof item.notes === 'string' && item.notes.length <= 500, 'Günlük ücret veya not geçersiz.');
}

export function validateSalaryAllocation(item: Omit<SalaryAllocation, 'id'>, period: SalaryPeriod): void {
  requireValue(!!item && item.period_id === period.id && ['manual', 'payment', 'debt', 'subscription'].includes(item.kind)
    && typeof item.title === 'string' && !!item.title.trim() && item.title.length <= 100
    && validMoney(item.amount_minor) && typeof item.notes === 'string' && item.notes.length <= 500,
  'Gider adı, tutarı veya notu geçersiz.');
  requireValue(item.kind === 'manual' ? item.source_id === null : validId(item.source_id!), 'Bağlanan gider geçersiz.');
  requireValue(item.kind === 'payment' || item.kind === 'subscription'
    ? isSalaryDate(item.occurrence_date) : item.occurrence_date === '' || isSalaryDate(item.occurrence_date), 'Giderin ödeme tarihi geçersiz.');
}

export function workEntryEarnings(item: Pick<SalaryWorkEntry, 'worked_minutes' | 'break_minutes' | 'hourly_rate_minor'>): number {
  const numerator = (item.worked_minutes - item.break_minutes) * item.hourly_rate_minor;
  requireValue(Number.isSafeInteger(numerator) && numerator >= 0, 'Çalışma tutarı hesaplanamadı.');
  return Math.floor((numerator + 30) / 60);
}

export function salarySummary(period: SalaryPeriod, entries: SalaryWorkEntry[], allocations: SalaryAllocation[]) {
  const days = entries.filter(item => item.period_id === period.id);
  const expenses = allocations.filter(item => item.period_id === period.id);
  const earned = period.mode === 'monthly' ? period.monthly_salary_minor : days.reduce((sum, item) => sum + workEntryEarnings(item), 0);
  const allocated = expenses.reduce((sum, item) => sum + item.amount_minor, 0);
  requireValue(Number.isSafeInteger(earned) && Number.isSafeInteger(allocated), 'Toplam tutar desteklenen aralığın dışında.');
  return { earned, allocated, remaining: earned - allocated, days: days.length,
    paidMinutes: days.reduce((sum, item) => sum + item.worked_minutes - item.break_minutes, 0),
    breakMinutes: days.reduce((sum, item) => sum + item.break_minutes, 0) };
}

export type SalaryExpenseCandidate = Omit<SalaryAllocation, 'id' | 'period_id' | 'notes'>;
export const salarySourceKey = (item: Pick<SalaryAllocation, 'kind' | 'source_id' | 'occurrence_date'>): string =>
  `${item.kind}:${item.source_id}:${item.kind === 'subscription' ? item.occurrence_date : ''}`;

export interface SalaryExpenseRange { start: string; end: string; includeEarlier: boolean }
export function salaryMonthRange(month: string, offset = 0): SalaryExpenseRange {
  requireValue(isSalaryMonth(month) && Number.isSafeInteger(offset), 'Geçerli bir ay seçin.');
  const [year, value] = month.split('-').map(Number);
  const start = new Date(year, value - 1 + offset, 1);
  const range = { start: formatLocalDateKey(start), end: formatLocalDateKey(new Date(start.getFullYear(), start.getMonth() + 1, 0)), includeEarlier: false };
  validateSalaryExpenseRange(range);
  return range;
}

export function validateSalaryExpenseRange(range: SalaryExpenseRange): void {
  requireValue(!!range && isSalaryDate(range.start) && isSalaryDate(range.end) && typeof range.includeEarlier === 'boolean', 'Başlangıç ve bitiş için geçerli tarihler girin.');
  requireValue(range.start <= range.end, 'Bitiş tarihi başlangıçtan önce olamaz.');
  const [sy, sm, sd] = range.start.split('-').map(Number);
  const [ey, em, ed] = range.end.split('-').map(Number);
  requireValue((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000 < 366, 'Tek seçimde en fazla 366 günlük giderleri listeleyebilirsiniz.');
}

export function salaryExpenseCandidates(period: SalaryPeriod, payments: Payment[], debts: Debt[], subscriptions: Subscription[], range = salaryMonthRange(period.month)): SalaryExpenseCandidate[] {
  validateSalaryExpenseRange(range);
  const start = parseLocalDate(range.start)!;
  const end = parseLocalDate(range.end)!;
  const inRange = (date: string) => isSalaryDate(date) && date <= range.end && (range.includeEarlier || date >= range.start);
  const result: SalaryExpenseCandidate[] = [];
  for (const payment of payments.filter(item => item.currency === period.currency && item.status !== 'paid' && inRange(item.due_date))) {
    const amount = expenseToMinor(payment.amount);
    if (amount && isSalaryDate(payment.due_date)) result.push({ kind: 'payment', source_id: payment.id, occurrence_date: payment.due_date, title: payment.name, amount_minor: amount });
  }
  for (const debt of debts.filter(item => item.currency === period.currency && item.debt_direction === 'owe' && item.total_amount > item.paid_amount && (!item.due_date || inRange(item.due_date)))) {
    const remaining = expenseToMinor(debt.total_amount) - expenseToMinor(debt.paid_amount);
    if (remaining > 0) result.push({ kind: 'debt', source_id: debt.id, occurrence_date: debt.due_date || '', title: debt.person_name, amount_minor: remaining });
  }
  for (const { date, subscription } of getSubscriptionOccurrences(subscriptions.filter(item => item.currency === period.currency), start, end)) {
    const amount = expenseToMinor(subscription.amount);
    if (amount) result.push({ kind: 'subscription', source_id: subscription.id, occurrence_date: date, title: subscription.name, amount_minor: amount });
  }
  return result.sort((a, b) => (a.occurrence_date || '9999').localeCompare(b.occurrence_date || '9999') || a.title.localeCompare(b.title, 'tr'));
}

export function salaryAllocationSource(period: SalaryPeriod, item: Pick<SalaryAllocation, 'kind' | 'source_id' | 'occurrence_date'>, payments: Payment[], debts: Debt[], subscriptions: Subscription[]): SalaryExpenseCandidate | undefined {
  const payment = item.kind === 'payment' ? payments.find(source => source.id === item.source_id) : undefined;
  const debt = item.kind === 'debt' ? debts.find(source => source.id === item.source_id) : undefined;
  const subscription = item.kind === 'subscription' ? subscriptions.find(source => source.id === item.source_id) : undefined;
  const date = payment?.due_date || debt?.due_date || (subscription ? item.occurrence_date : `${period.month}-01`);
  if (!isSalaryDate(date)) return undefined;
  return salaryExpenseCandidates(period, payment ? [payment] : [], debt ? [debt] : [], subscription ? [subscription] : [], { start: date, end: date, includeEarlier: false })
    .find(source => salarySourceKey(source) === salarySourceKey(item));
}

export function salaryAllocationGroups(items: SalaryAllocation[]) {
  const groups = new Map<string, { month: string; amount: number; items: SalaryAllocation[] }>();
  for (const item of items) {
    const month = item.occurrence_date ? item.occurrence_date.slice(0, 7) : '';
    const group = groups.get(month) ?? { month, amount: 0, items: [] };
    group.amount += item.amount_minor;
    requireValue(Number.isSafeInteger(group.amount), 'Toplam tutar desteklenen aralığın dışında.');
    group.items.push(item); groups.set(month, group);
  }
  return [...groups.values()].sort((a, b) => (a.month || '9999').localeCompare(b.month || '9999'));
}

export function validateSalaryBackup(raw: unknown): SalaryData {
  if (raw === undefined) return { periods: [], workEntries: [], allocations: [] };
  const data = raw as SalaryData;
  requireValue(!!data && Array.isArray(data.periods) && Array.isArray(data.workEntries) && Array.isArray(data.allocations), 'Maaş yedeği geçersiz.');
  const periods = new Map<number, SalaryPeriod>();
  const monthKeys = new Set<string>();
  for (const item of data.periods) {
    requireValue(!!item && validId(item.id) && !periods.has(item.id), 'Maaş yedeğinde dönem kimliği geçersiz.');
    validateSalaryPeriod(item);
    const key = `${item.month}:${item.currency}`;
    requireValue(!monthKeys.has(key), 'Maaş yedeğinde yinelenen dönem var.');
    monthKeys.add(key); periods.set(item.id, item);
  }
  const entryIds = new Set<number>();
  const dates = new Set<string>();
  for (const item of data.workEntries) {
    requireValue(!!item && validId(item.id) && !entryIds.has(item.id) && periods.has(item.period_id), 'Maaş yedeğinde çalışma kaydı geçersiz.');
    validateSalaryWorkEntry(item, periods.get(item.period_id)!);
    const key = `${item.period_id}:${item.date}`;
    requireValue(!dates.has(key), 'Maaş yedeğinde yinelenen çalışma günü var.');
    entryIds.add(item.id); dates.add(key);
  }
  const allocationIds = new Set<number>();
  const sources = new Set<string>();
  for (const item of data.allocations) {
    requireValue(!!item && validId(item.id) && !allocationIds.has(item.id) && periods.has(item.period_id), 'Maaş yedeğinde gider kaydı geçersiz.');
    validateSalaryAllocation(item, periods.get(item.period_id)!);
    const key = item.kind === 'debt' ? `${item.period_id}:${salarySourceKey(item)}` : salarySourceKey(item);
    if (item.kind !== 'manual') { requireValue(!sources.has(key), 'Maaş yedeğinde yinelenen gider var.'); sources.add(key); }
    allocationIds.add(item.id);
  }
  for (const period of data.periods) salarySummary(period, data.workEntries, data.allocations);
  return data;
}