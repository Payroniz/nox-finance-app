import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting } from '../db/database';

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
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Ödeme Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });

    await Notifications.setNotificationChannelAsync('debts', {
      name: 'Borç Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5B5B',
    });

    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Günlük Özet',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    });
  }
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

export const removeLegacySensitiveNotifications = async (): Promise<void> => {
  if (await getSetting('notificationPrivacyMigrated') === 'true') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    const data = notification.content.data as Record<string, unknown> | undefined;
    if (data?.name || data?.person) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  //Bildirim merkezinde eski sürümden kalmış hassas içerikleri de kaldır.
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
  await setSetting('notificationPrivacyMigrated', 'true');
};

export const schedulePaymentNotification = async (
  payment: { name: string; amount: number; currency: string; due_date: string; due_time: string },
  reminderDays: number = 3
): Promise<string> => {
  if (!(await canScheduleNotifications())) return '';

  const dueDate = new Date(payment.due_date);
  //timezone kaymasını önlemek için UTC saatini sıfırla
  dueDate.setUTCHours(0, 0, 0, 0);
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - reminderDays);

  const [hours, minutes] = payment.due_time.split(':').map(Number);
  reminderDate.setHours(hours, minutes, 0, 0);

  if (reminderDate <= new Date()) {
    return '';
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💳 Yaklaşan Ödeme',
      body: 'Detayları görmek için NoX Finance uygulamasını açın.',
      data: { type: 'payment' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: 'payments',
    },
  });

  return id;
};

export const scheduleDebtNotification = async (
  debt: { person_name: string; total_amount: number; currency: string; due_date: string; debt_direction: string },
  reminderDays: number[] = [1, 3, 7]
): Promise<string[]> => {
  if (!(await canScheduleNotifications())) return [];
  if (!debt.due_date) return [];

  const ids: string[] = [];
  const dueDate = new Date(debt.due_date);

  for (const days of reminderDays) {
    const reminderDate = new Date(dueDate);
    //timezone kaymasını önlemek için UTC saatini sıfırla
    reminderDate.setUTCHours(0, 0, 0, 0);
    reminderDate.setDate(reminderDate.getDate() - days);
    reminderDate.setHours(9, 0, 0, 0);

    const now = new Date();
    if (reminderDate <= now) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Borç Hatırlatıcısı',
        body: 'Detayları görmek için NoX Finance uygulamasını açın.',
        data: { type: 'debt' },
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

  const [hours, minutes] = time.split(':').map(Number);

  await cancelDailySummary();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 Günlük Özet',
      body: 'Bugünkü ödemelerinizi kontrol etmek için dokunun.',
      data: { type: 'daily_summary' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
      channelId: 'daily',
    },
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

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
};
