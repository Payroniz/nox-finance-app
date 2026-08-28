import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getAllSettings,
  getDebts,
  getPayments,
  getSetting,
  setSetting,
  updateDebt,
  updatePayment,
} from '../db/database';
import { parseLocalDate } from './helpers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const configureNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Ödeme Hatırlatıcıları',
    description: 'Yaklaşan ve geciken ödemeler için hatırlatmalar',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C63FF',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('debts', {
    name: 'Borç ve Alacak Hatırlatıcıları',
    description: 'Borç ve alacak son tarihleri için hatırlatmalar',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF5B5B',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('daily', {
    name: 'Günlük Özet',
    description: 'Günlük finans kontrolü hatırlatması',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    sound: 'default',
  });
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  await configureNotificationChannels();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

export const canScheduleNotifications = async (): Promise<boolean> => {
  const [enabled, permissions] = await Promise.all([
    getSetting('notificationsEnabled'),
    Notifications.getPermissionsAsync(),
  ]);
  return enabled === 'true' && permissions.status === 'granted';
};

export const parseNotificationIds = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(id => typeof id === 'string' && id.length > 0);
  } catch {
  }
  return [value];
};

export const parseReminderDays = (value?: string | null, fallback: number[] = [1, 3]): number[] => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const days = [...new Set<number>(parsed.filter(day => Number.isInteger(day) && day >= 0))].sort((a, b) => a - b);
      return days.length > 0 ? days : fallback;
    }
  } catch {
    const legacy = parseInt(value, 10);
    if (Number.isInteger(legacy) && legacy >= 0) return [legacy];
  }
  return fallback;
};

const createReminderDate = (dueDateValue: string, time: string, daysBefore: number): Date | null => {
  const dueDate = parseLocalDate(dueDateValue);
  if (!dueDate) return null;

  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const hours = Number.isInteger(rawHours) && rawHours >= 0 && rawHours <= 23 ? rawHours : 9;
  const minutes = Number.isInteger(rawMinutes) && rawMinutes >= 0 && rawMinutes <= 59 ? rawMinutes : 0;
  dueDate.setHours(hours, minutes, 0, 0);
  dueDate.setDate(dueDate.getDate() - daysBefore);
  return dueDate;
};

export const removeLegacySensitiveNotifications = async (): Promise<void> => {
  if (await getSetting('notificationPrivacyMigrated') === 'true') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    const data = notification.content.data as Record<string, unknown> | undefined;
    if (data?.name || data?.person) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
  await setSetting('notificationPrivacyMigrated', 'true');
};

export const schedulePaymentNotification = async (
  payment: {
    id?: number;
    name: string;
    amount: number;
    currency: string;
    due_date: string;
    due_time: string;
  },
  reminderDays: number[] | number = [1, 3]
): Promise<string[]> => {
  if (!(await canScheduleNotifications())) return [];

  const ids: string[] = [];
  const daysList = Array.isArray(reminderDays) ? reminderDays : [reminderDays];
  let catchUpScheduled = false;
  for (const days of [...new Set(daysList)].sort((a, b) => a - b)) {
    let reminderDate = createReminderDate(payment.due_date, payment.due_time, days);
    const now = new Date();
    let isCatchUp = false;
    if (!reminderDate) continue;
    if (reminderDate <= now) {
      const dueMoment = createReminderDate(payment.due_date, payment.due_time, 0);
      if (days === 0 || catchUpScheduled || !dueMoment || dueMoment <= now) continue;
      reminderDate = new Date(now.getTime() + 3_000);
      catchUpScheduled = true;
      isCatchUp = true;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: days === 0 ? '💳 Ödeme Günü' : '💳 Yaklaşan Ödeme',
        body: isCatchUp
          ? 'Hatırlatma zamanı başlayan ödemenizi kontrol edin.'
          : days === 0
          ? 'Bugün vadesi gelen ödemenizi kontrol edin.'
          : `${days} gün sonra vadesi gelen ödemenizi kontrol edin.`,
        data: { type: 'payment', entityId: payment.id, reminderDays: days, dueDate: payment.due_date },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: 'payments',
      },
    });
    ids.push(id);
  }
  return ids;
};

export const scheduleDebtNotification = async (
  debt: {
    id?: number;
    person_name: string;
    total_amount: number;
    currency: string;
    due_date: string;
    debt_direction: string;
  },
  reminderDays: number[] = [1, 3, 7]
): Promise<string[]> => {
  if (!(await canScheduleNotifications()) || !debt.due_date) return [];

  const ids: string[] = [];
  let catchUpScheduled = false;
  for (const days of [...new Set(reminderDays)].sort((a, b) => a - b)) {
    let reminderDate = createReminderDate(debt.due_date, '09:00', days);
    const now = new Date();
    let isCatchUp = false;
    if (!reminderDate) continue;
    if (reminderDate <= now) {
      const dueMoment = createReminderDate(debt.due_date, '09:00', 0);
      if (days === 0 || catchUpScheduled || !dueMoment || dueMoment <= now) continue;
      reminderDate = new Date(now.getTime() + 3_000);
      catchUpScheduled = true;
      isCatchUp = true;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: debt.debt_direction === 'owed' ? '💰 Alacak Hatırlatıcısı' : '💰 Borç Hatırlatıcısı',
        body: isCatchUp
          ? 'Hatırlatma zamanı başlayan kaydınızı kontrol edin.'
          : days === 0
          ? 'Bugün vadesi gelen kaydınızı kontrol edin.'
          : `${days} gün sonra vadesi gelen kaydınızı kontrol edin.`,
        data: { type: 'debt', entityId: debt.id, reminderDays: days, dueDate: debt.due_date },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: 'debts',
      },
    });
    ids.push(id);
  }
  return ids;
};

export const scheduleDailySummary = async (time: string): Promise<string> => {
  if (!(await canScheduleNotifications())) return '';
  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const hours = Number.isInteger(rawHours) && rawHours >= 0 && rawHours <= 23 ? rawHours : 8;
  const minutes = Number.isInteger(rawMinutes) && rawMinutes >= 0 && rawMinutes <= 59 ? rawMinutes : 0;

  await cancelDailySummary();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 Günlük Özet',
      body: 'Bugünkü ödeme, borç ve alacaklarınızı kontrol edin.',
      data: { type: 'daily_summary' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
      channelId: 'daily',
    },
  });
};

export const cancelDailySummary = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if ((notification.content.data as Record<string, unknown> | undefined)?.type === 'daily_summary') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

const cancelEntityNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    const type = (notification.content.data as Record<string, unknown> | undefined)?.type;
    if (type === 'payment' || type === 'debt') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

export const rescheduleAllNotifications = async (): Promise<number> => {
  if (!(await canScheduleNotifications())) return 0;
  await configureNotificationChannels();
  await cancelEntityNotifications();

  const [payments, debts, settings] = await Promise.all([getPayments(), getDebts(), getAllSettings()]);
  let scheduledCount = 0;

  for (const payment of payments.filter(item => item.status !== 'paid')) {
    const days = parseReminderDays(payment.reminder_days, settings.defaultReminderDays);
    const ids = await schedulePaymentNotification({ ...payment, id: payment.id }, days);
    scheduledCount += ids.length;
    await updatePayment(payment.id, { notification_id: JSON.stringify(ids), reminder_days: JSON.stringify(days) });
  }

  for (const debt of debts.filter(item => item.due_date && item.total_amount > item.paid_amount)) {
    const days = parseReminderDays(debt.reminder_days, settings.defaultReminderDays);
    const ids = await scheduleDebtNotification({ ...debt, id: debt.id }, days);
    scheduledCount += ids.length;
    await updateDebt(debt.id, { notification_ids: JSON.stringify(ids), reminder_days: JSON.stringify(days) });
  }

  await scheduleDailySummary(settings.dailySummaryTime);
  await setSetting('lastNotificationRefreshAt', new Date().toISOString());
  await setSetting('notificationScheduleMigrationV3', 'true');
  return scheduledCount;
};

export const migrateNotificationSchedulesIfNeeded = async (): Promise<number> => {
  if (await getSetting('notificationScheduleMigrationV3') === 'true') return 0;
  return rescheduleAllNotifications();
};

export const scheduleTestNotification = async (): Promise<void> => {
  if (!(await canScheduleNotifications())) throw new Error('NOTIFICATIONS_DISABLED');
  await configureNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ NoX bildirimleri çalışıyor',
      body: 'Hatırlatıcılar bu cihazda başarıyla etkinleştirildi.',
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
      channelId: 'payments',
    },
  });
};

export const getNotificationDiagnostics = async (): Promise<{ permission: string; scheduledCount: number }> => {
  const [permission, scheduled] = await Promise.all([
    Notifications.getPermissionsAsync(),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);
  return { permission: permission.status, scheduledCount: scheduled.length };
};

export const cancelNotification = async (value: string): Promise<void> => {
  for (const id of parseNotificationIds(value)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
};

export const cancelMultipleNotifications = async (ids: string[]): Promise<void> => {
  for (const id of ids) await cancelNotification(id);
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
};
