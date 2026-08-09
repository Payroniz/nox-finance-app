import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Payment, Debt } from '../constants/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Ödeme Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });

    await Notifications.setNotificationChannelAsync('debts', {
      name: 'Borç Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5B5B',
    });

    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Günlük Özet',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return finalStatus === 'granted';
};

export const schedulePaymentNotification = async (
  payment: { name: string; amount: number; currency: string; due_date: string; due_time: string },
  reminderDays: number = 3
): Promise<string> => {
  const dueDate = new Date(payment.due_date);
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - reminderDays);

  const [hours, minutes] = payment.due_time.split(':').map(Number);
  reminderDate.setHours(hours, minutes, 0, 0);

  if (reminderDate <= new Date()) {
    return '';
  }

  const currencySymbol = payment.currency === 'TRY' ? '₺' : payment.currency === 'USD' ? '$' : '€';
  const amount = formatCurrency(payment.amount, payment.currency);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💳 Yaklaşan Ödeme',
      body: `${payment.name} için ${amount} ödemeniz ${reminderDays} gün içinde!`,
      data: { type: 'payment', name: payment.name },
      channelId: 'payments',
    },
    trigger: {
      date: reminderDate,
    } as any,
  });

  return id;
};

export const scheduleDebtNotification = async (
  debt: { person_name: string; total_amount: number; currency: string; due_date: string; debt_direction: string },
  reminderDays: number[] = [1, 3, 7]
): Promise<string[]> => {
  const ids: string[] = [];
  const dueDate = new Date(debt.due_date);
  const amount = formatCurrency(debt.total_amount, debt.currency);
  const direction = debt.debt_direction === 'owe' ? `${debt.person_name}'e` : `${debt.person_name}'den`;

  for (const days of reminderDays) {
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - days);
    reminderDate.setHours(9, 0, 0, 0);

    if (reminderDate <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Borç Hatırlatıcısı',
        body: `${direction} olan ${amount} borç ${days} gün içinde!`,
        data: { type: 'debt', person: debt.person_name },
        channelId: 'debts',
      },
      trigger: {
        date: reminderDate,
      } as any,
    });

    ids.push(id);
  }

  return ids;
};

export const scheduleDailySummary = async (time: string): Promise<string> => {
  const [hours, minutes] = time.split(':').map(Number);

  await cancelDailySummary();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 Günlük Özet',
      body: 'Bugünkü ödemelerinizi kontrol etmek için dokunun.',
      data: { type: 'daily_summary' },
      channelId: 'daily',
    },
    trigger: {
      hour: hours,
      minute: minutes,
      repeats: true,
    } as any,
  });

  return id;
};

export const cancelDailySummary = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === 'daily_summary') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
};

export const cancelNotification = async (id: string): Promise<void> => {
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
};

export const cancelMultipleNotifications = async (ids: string[]): Promise<void> => {
  for (const id of ids) {
    await cancelNotification(id);
  }
};

export const formatCurrency = (amount: number, currency: string): string => {
  if (currency === 'TRY') {
    return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
  } else if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  } else if (currency === 'EUR') {
    return `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
  } else if (currency === 'GBP') {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  }
  return `${amount} ${currency}`;
};
