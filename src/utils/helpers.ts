import { format, isBefore, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Currency, PaymentStatus, DebtStatus } from '../constants/types';

export const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (dateOnly) {
    const parsed = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatCurrency = (amount: number, currency: Currency = 'TRY'): string => {
  switch (currency) {
    case 'TRY':
      return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
    case 'USD':
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'EUR':
      return `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'GBP':
      return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:
      return `${amount} ${currency}`;
  }
};

export const formatDate = (dateStr: string, pattern: string = 'dd MMMM yyyy'): string => {
  const date = parseLocalDate(dateStr);
  if (!date) return 'Tarih belirtilmedi';
  try {
    return format(date, pattern, { locale: tr });
  } catch {
    return 'Tarih belirtilmedi';
  }
};

export const formatDateShort = (dateStr: string): string => {
  return formatDate(dateStr, 'dd MMM');
};

export const formatDateWithTime = (dateStr: string, timeStr: string): string => {
  try {
    const date = parseLocalDate(dateStr);
    if (!date) return 'Tarih belirtilmedi';
    const [h, m] = timeStr.split(':');
    date.setHours(parseInt(h), parseInt(m));
    return format(date, 'dd MMMM yyyy, HH:mm', { locale: tr });
  } catch {
    return `${dateStr} ${timeStr}`;
  }
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Günaydın';
  if (hour >= 12 && hour < 17) return 'İyi öğlenler';
  if (hour >= 17 && hour < 21) return 'İyi akşamlar';
  return 'İyi geceler';
};

export const getTodayString = (): string => {
  return formatLocalDateKey(new Date());
};

export const determinePaymentStatus = (dueDate: string, currentStatus: PaymentStatus): PaymentStatus => {
  if (currentStatus === 'paid') return 'paid';
  const due = parseLocalDate(dueDate);
  if (!due) return currentStatus;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isBefore(due, today)) return 'overdue';
  return 'pending';
};

export const determineDebtStatus = (dueDate: string): DebtStatus => {
  if (!dueDate) return 'ontime';
  const due = parseLocalDate(dueDate);
  if (!due) return 'ontime';
  const today = new Date();
  if (isBefore(due, today)) return 'overdue';
  if (differenceInDays(due, today) <= 7) return 'approaching';
  return 'ontime';
};

export const getStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case 'paid': return '#4CAF82';
    case 'pending': return '#6C63FF';
    case 'overdue': return '#FF5B5B';
  }
};

export const getStatusLabel = (status: PaymentStatus): string => {
  switch (status) {
    case 'paid': return 'Ödendi';
    case 'pending': return 'Bekliyor';
    case 'overdue': return 'Gecikti';
  }
};

export const getStatusIcon = (status: PaymentStatus): string => {
  switch (status) {
    case 'paid': return 'check-circle';
    case 'pending': return 'clock-outline';
    case 'overdue': return 'alert-circle';
  }
};

export const getDebtStatusColor = (status: DebtStatus): string => {
  switch (status) {
    case 'ontime': return '#4CAF82';
    case 'approaching': return '#F5A623';
    case 'overdue': return '#FF5B5B';
  }
};

export const getRecurrenceLabel = (recurrence: string): string => {
  switch (recurrence) {
    case 'once': return 'Tek Seferlik';
    case 'weekly': return 'Haftalık';
    case 'monthly': return 'Aylık';
    case 'yearly': return 'Yıllık';
    default: return recurrence;
  }
};

export const getDaysUntilDue = (dueDate: string): number => {
  const due = parseLocalDate(dueDate);
  if (!due) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(due, today);
};

export const getDueDateLabel = (dueDate: string): string => {
  if (!dueDate) return '';
  const days = getDaysUntilDue(dueDate);
  if (days < 0) return `${Math.abs(days)} gün gecikti`;
  if (days === 0) return 'Bugün son gün!';
  if (days === 1) return 'Yarın son gün';
  if (days <= 7) return `${days} gün kaldı`;
  return formatDateShort(dueDate);
};

export const generateColors = (count: number): string[] => {
  const palette = [
    '#6C63FF', '#FF6B6B', '#4CAF82', '#FFD93D', '#FF8C42',
    '#26C6DA', '#FF80AB', '#AB47BC', '#78909C', '#F5A623',
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
};

export const getTimeRemaining = (dueDate: string, dueTime?: string): string => {
  try {
    const due = parseLocalDate(dueDate);
    if (!due) return '';
    if (dueTime) {
      const [h, m] = dueTime.split(':').map(Number);
      due.setHours(h, m, 0, 0);
    }
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    if (diffMs <= 0) return 'Geçti';

    const totalMinutes = Math.floor(diffMs / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} yıl`);
    if (months > 0) parts.push(`${months} ay`);
    if (days > 0 || parts.length === 0) parts.push(`${days} gün`);
    return parts.join(', ') + ' kaldı';
  } catch {
    return '';
  }
};

export const calculateSimpleInterest = (
  principal: number,
  rate: number,
  days: number
): number => {
  return principal * (rate / 100) * (days / 365);
};
