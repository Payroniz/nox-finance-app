import * as SQLite from 'expo-sqlite';
import { Payment, Debt, DebtPayment, Category, Settings, AppSettings, Currency, BackupDestination, BackupFrequency, UploadedIcon, Subscription, SubscriptionInput } from '../constants/types';
import { formatLocalDateKey, parseLocalDate } from '../utils/helpers';
import { validateSubscription } from '../utils/subscriptions';

const DATABASE_NAME = 'nox.db';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      category TEXT NOT NULL DEFAULT 'Diğer',
      icon_type TEXT NOT NULL DEFAULT 'icon',
      icon_value TEXT NOT NULL DEFAULT 'cash',
      due_date TEXT NOT NULL,
      due_time TEXT NOT NULL DEFAULT '09:00',
      recurrence TEXT NOT NULL DEFAULT 'once',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT DEFAULT '',
      reminder_days TEXT DEFAULT '[]',
      notification_id TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'TRY',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      renewal_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      person_photo TEXT DEFAULT '',
      icon_type TEXT NOT NULL DEFAULT 'icon',
      icon_value TEXT NOT NULL DEFAULT 'account-cash',
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'TRY',
      debt_direction TEXT NOT NULL DEFAULT 'owe',
      due_date TEXT NOT NULL,
      interest_rate REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      reminder_days TEXT DEFAULT '[]',
      notification_ids TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL DEFAULT '#78909C',
      is_custom INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await migrateSchema(database);

  await seedDefaultCategories(database);

  await seedDefaultSettings(database);

  await normalizeLegacyDates(database);
  await refreshOverduePaymentStatuses(database);
};

const migrateSchema = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const paymentColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(payments)');
  if (!paymentColumns.some(column => column.name === 'reminder_days')) {
    await database.execAsync("ALTER TABLE payments ADD COLUMN reminder_days TEXT DEFAULT '[]'");
  }

  const debtColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(debts)');
  if (!debtColumns.some(column => column.name === 'reminder_days')) {
    await database.execAsync("ALTER TABLE debts ADD COLUMN reminder_days TEXT DEFAULT '[]'");
  }
  if (!debtColumns.some(column => column.name === 'icon_type')) {
    await database.execAsync("ALTER TABLE debts ADD COLUMN icon_type TEXT NOT NULL DEFAULT 'icon'");
  }
  if (!debtColumns.some(column => column.name === 'icon_value')) {
    await database.execAsync("ALTER TABLE debts ADD COLUMN icon_value TEXT NOT NULL DEFAULT 'account-cash'");
  }
};

const normalizeLegacyDates = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const migrated = await database.getFirstAsync<Settings>(
    "SELECT * FROM settings WHERE key = 'localDateMigrationV3'"
  );
  if (migrated?.value === 'true') return;

  const payments = await database.getAllAsync<Pick<Payment, 'id' | 'due_date'>>(
    'SELECT id, due_date FROM payments'
  );
  for (const payment of payments) {
    const parsed = parseLocalDate(payment.due_date);
    if (parsed) {
      await database.runAsync('UPDATE payments SET due_date = ? WHERE id = ?', [formatLocalDateKey(parsed), payment.id]);
    }
  }

  const debts = await database.getAllAsync<Pick<Debt, 'id' | 'due_date'>>(
    "SELECT id, due_date FROM debts WHERE due_date != ''"
  );
  for (const debt of debts) {
    const parsed = parseLocalDate(debt.due_date);
    if (parsed) {
      await database.runAsync('UPDATE debts SET due_date = ? WHERE id = ?', [formatLocalDateKey(parsed), debt.id]);
    }
  }

  await database.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('localDateMigrationV3', 'true')"
  );
};

const refreshOverduePaymentStatuses = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const today = formatLocalDateKey(new Date());
  await database.runAsync(
    "UPDATE payments SET status = CASE WHEN due_date < ? THEN 'overdue' ELSE 'pending' END WHERE status != 'paid'",
    [today]
  );
};

const seedDefaultCategories = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const existing = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE is_custom = 0'
  );

  if (existing && existing.count > 0) return;

  const defaults = [
    { name: 'Fatura', icon: 'flash', color: '#FF6B6B' },
    { name: 'Abonelik', icon: 'refresh', color: '#6C63FF' },
    { name: 'Kira', icon: 'home', color: '#FFD93D' },
    { name: 'Kredi', icon: 'bank', color: '#FF8C42' },
    { name: 'Market', icon: 'cart', color: '#4CAF82' },
    { name: 'Ulaşım', icon: 'car', color: '#26C6DA' },
    { name: 'Sağlık', icon: 'medical-bag', color: '#FF80AB' },
    { name: 'Eğlence', icon: 'gamepad', color: '#AB47BC' },
    { name: 'Diğer', icon: 'dots-horizontal', color: '#78909C' },
  ];

  for (const cat of defaults) {
    await database.runAsync(
      'INSERT OR IGNORE INTO categories (name, icon, color, is_custom) VALUES (?, ?, ?, 0)',
      [cat.name, cat.icon, cat.color]
    );
  }
};

const seedDefaultSettings = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const defaults: { key: string; value: string }[] = [
    { key: 'userName', value: 'Kullanıcı' },
    { key: 'profilePhoto', value: '' },
    { key: 'defaultCurrency', value: 'TRY' },
    { key: 'theme', value: 'dark' },
    { key: 'notificationsEnabled', value: 'false' },
    { key: 'defaultReminderDays', value: '[1,3]' },
    { key: 'dailySummaryTime', value: '08:00' },
    { key: 'pinEnabled', value: 'false' },
    { key: 'biometricEnabled', value: 'false' },
    { key: 'onboardingCompleted', value: 'false' },
    { key: 'autoLockMinutes', value: '1' },
    { key: 'automaticBackupEnabled', value: 'false' },
    { key: 'backupFrequency', value: 'weekly' },
    { key: 'backupDestination', value: 'device' },
    { key: 'backupDirectoryUri', value: '' },
    { key: 'backupDirectoryLabel', value: '' },
    { key: 'lastBackupAt', value: '' },
  ];

  for (const setting of defaults) {
    await database.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
};

export const getPayments = async (): Promise<Payment[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Payment>('SELECT * FROM payments ORDER BY due_date ASC');
};

export const getSubscriptions = async (): Promise<Subscription[]> =>
  (await getDatabase()).getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY active DESC, renewal_date ASC');

export const saveSubscription = async (item: SubscriptionInput, id?: number): Promise<void> => {
  validateSubscription(item);
  const database = await getDatabase();
  const values = [item.name.trim(), item.amount, item.currency, item.billing_cycle, item.renewal_date, item.active, item.notes.trim()];
  if (id !== undefined) {
    await database.runAsync('UPDATE subscriptions SET name = ?, amount = ?, currency = ?, billing_cycle = ?, renewal_date = ?, active = ?, notes = ? WHERE id = ?', [...values, id]);
  } else {
    await database.runAsync('INSERT INTO subscriptions (name, amount, currency, billing_cycle, renewal_date, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', values);
  }
};

export const deleteSubscription = async (id: number): Promise<void> => {
  await (await getDatabase()).runAsync('DELETE FROM subscriptions WHERE id = ?', [id]);
};

export const getPaymentsByDate = async (date: string): Promise<Payment[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE strftime('%Y-%m-%d', due_date) = ? ORDER BY due_time ASC",
    [date]
  );
};

export const getPaymentsByMonth = async (year: number, month: number): Promise<Payment[]> => {
  const database = await getDatabase();
  const monthStr = String(month).padStart(2, '0');
  return await database.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE strftime('%Y-%m', due_date) = ? ORDER BY due_date ASC",
    [`${year}-${monthStr}`]
  );
};

export const getUpcomingPayments = async (limit: number = 3): Promise<Payment[]> => {
  const database = await getDatabase();
  const today = formatLocalDateKey(new Date());
  return await database.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE due_date >= ? AND status != 'paid' ORDER BY due_date ASC LIMIT ?",
    [today, limit]
  );
};

export const addPayment = async (payment: Omit<Payment, 'id' | 'created_at'>): Promise<number> => {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO payments (name, amount, currency, category, icon_type, icon_value, due_date, due_time, recurrence, status, notes, reminder_days, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.name, payment.amount, payment.currency, payment.category,
      payment.icon_type, payment.icon_value, payment.due_date, payment.due_time,
      payment.recurrence, payment.status, payment.notes, payment.reminder_days, payment.notification_id,
    ]
  );
  return result.lastInsertRowId;
};

export const updatePaymentStatus = async (id: number, status: string): Promise<void> => {
  const database = await getDatabase();
  if (status === 'paid') {
    await database.runAsync(
      "UPDATE payments SET status = ?, notification_id = '' WHERE id = ?",
      [status, id]
    );
    return;
  }
  await database.runAsync('UPDATE payments SET status = ? WHERE id = ?', [status, id]);
};

export const updatePayment = async (id: number, payment: Partial<Payment>): Promise<void> => {
  const database = await getDatabase();
  const fields = Object.keys(payment).filter(k => k !== 'id' && k !== 'created_at');
  const values = fields.map(f => (payment as any)[f]);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  await database.runAsync(`UPDATE payments SET ${setClause} WHERE id = ?`, [...values, id]);
};

export const deletePayment = async (id: number): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM payments WHERE id = ?', [id]);
};

export const getMarkedDates = async (year: number, month: number): Promise<Record<string, any>> => {
  const payments = await getPaymentsByMonth(year, month);
  const marked: Record<string, any> = {};

  for (const p of payments) {
    const date = p.due_date.split('T')[0];
    const color = p.status === 'paid' ? '#4CAF82' : p.status === 'overdue' ? '#FF5B5B' : '#6C63FF';
    if (!marked[date]) {
      marked[date] = { dots: [] };
    }
    marked[date].dots.push({ color });
  }

  return marked;
};

export const getDebts = async (direction?: 'owe' | 'owed'): Promise<Debt[]> => {
  const database = await getDatabase();
  if (direction) {
    return await database.getAllAsync<Debt>(
      'SELECT * FROM debts WHERE debt_direction = ? ORDER BY due_date ASC',
      [direction]
    );
  }
  return await database.getAllAsync<Debt>('SELECT * FROM debts ORDER BY due_date ASC');
};

export const getDebtById = async (id: number): Promise<Debt | null> => {
  const database = await getDatabase();
  return await database.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', [id]);
};

export const addDebt = async (debt: Omit<Debt, 'id' | 'created_at'>): Promise<number> => {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO debts (person_name, person_photo, icon_type, icon_value, total_amount, paid_amount, currency, debt_direction, due_date, interest_rate, notes, reminder_days, notification_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      debt.person_name, debt.person_photo, debt.icon_type, debt.icon_value, debt.total_amount, debt.paid_amount,
      debt.currency, debt.debt_direction, debt.due_date, debt.interest_rate,
      debt.notes, debt.reminder_days, debt.notification_ids,
    ]
  );
  return result.lastInsertRowId;
};

export const updateDebt = async (id: number, debt: Partial<Debt>): Promise<void> => {
  const database = await getDatabase();
  const fields = Object.keys(debt).filter(k => k !== 'id' && k !== 'created_at');
  const values = fields.map(f => (debt as any)[f]);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  await database.runAsync(`UPDATE debts SET ${setClause} WHERE id = ?`, [...values, id]);
};

export const deleteDebt = async (id: number): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM debts WHERE id = ?', [id]);
};

export const addDebtPayment = async (debtPayment: Omit<DebtPayment, 'id'>): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO debt_payments (debt_id, amount, paid_at, notes) VALUES (?, ?, ?, ?)',
    [debtPayment.debt_id, debtPayment.amount, debtPayment.paid_at, debtPayment.notes]
  );
  await database.runAsync(
    'UPDATE debts SET paid_amount = paid_amount + ? WHERE id = ?',
    [debtPayment.amount, debtPayment.debt_id]
  );
};

export const getDebtPayments = async (debtId: number): Promise<DebtPayment[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<DebtPayment>(
    'SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY paid_at DESC',
    [debtId]
  );
};

export const getCategories = async (): Promise<Category[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Category>('SELECT * FROM categories ORDER BY is_custom ASC, name ASC');
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO categories (name, icon, color, is_custom) VALUES (?, ?, ?, ?)',
    [category.name, category.icon, category.color, category.is_custom ? 1 : 0]
  );
};

export const deleteCategory = async (id: number): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM categories WHERE id = ? AND is_custom = 1', [id]);
};

export const getUploadedIcons = async (): Promise<UploadedIcon[]> => {
  const database = await getDatabase();
  return database.getAllAsync<UploadedIcon>('SELECT * FROM uploaded_icons ORDER BY created_at DESC, id DESC');
};

export const addUploadedIcon = async (uri: string, name = ''): Promise<number> => {
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT OR IGNORE INTO uploaded_icons (uri, name) VALUES (?, ?)',
    [uri, name]
  );
  return result.lastInsertRowId;
};

export const deleteUploadedIcon = async (id: number): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM uploaded_icons WHERE id = ?', [id]);
};

export const getSetting = async (key: string): Promise<string | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Settings>('SELECT * FROM settings WHERE key = ?', [key]);
  return result?.value ?? null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
};

export const purgeLegacyPin = async (): Promise<void> => {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM settings WHERE key = 'pinCode'"
  );
  if (!existing?.count) return;

  await database.runAsync("DELETE FROM settings WHERE key = 'pinCode'");
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
};

export const getAllSettings = async (): Promise<AppSettings> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Settings>('SELECT * FROM settings');
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  const reminderDays = (() => {
    try {
      const parsed = JSON.parse(map.defaultReminderDays ?? '[1,3]');
      if (Array.isArray(parsed)) {
        const days = parsed.filter(value => Number.isInteger(value) && value >= 0);
        if (days.length > 0) return days;
      }
    } catch {
      const legacy = parseInt(map.defaultReminderDays ?? '3', 10);
      if (Number.isInteger(legacy)) return [legacy];
    }
    return [1, 3];
  })();

  return {
    userName: map.userName ?? 'Kullanıcı',
    profilePhoto: map.profilePhoto ?? '',
    defaultCurrency: (map.defaultCurrency ?? 'TRY') as Currency,
    theme: (map.theme ?? 'dark') as 'dark' | 'light' | 'system',
    notificationsEnabled: map.notificationsEnabled === 'true',
    defaultReminderDays: reminderDays,
    dailySummaryTime: map.dailySummaryTime ?? '08:00',
    pinEnabled: map.pinEnabled === 'true',
    biometricEnabled: map.biometricEnabled === 'true',
    onboardingCompleted: map.onboardingCompleted === 'true',
    autoLockMinutes: parseInt(map.autoLockMinutes ?? '1'),
    automaticBackupEnabled: map.automaticBackupEnabled === 'true',
    backupFrequency: (map.backupFrequency ?? 'weekly') as BackupFrequency,
    backupDestination: (map.backupDestination ?? 'device') as BackupDestination,
    backupDirectoryUri: map.backupDirectoryUri ?? '',
    backupDirectoryLabel: map.backupDirectoryLabel ?? '',
    lastBackupAt: map.lastBackupAt ?? '',
  };
};

export const getMonthlyStats = async (year: number, month: number) => {
  const database = await getDatabase();
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;

  const payments = await database.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE strftime('%Y-%m', due_date) = ?",
    [prefix]
  );

  const totalExpense = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const overdueCount = payments.filter(p => p.status === 'overdue').length;

  const catMap: Record<string, number> = {};
  for (const p of payments) {
    catMap[p.category] = (catMap[p.category] || 0) + p.amount;
  }

  const categories = await getCategories();
  const categoryBreakdown = Object.entries(catMap).map(([cat, amount]) => {
    const catObj = categories.find(c => c.name === cat);
    return { category: cat, amount, color: catObj?.color ?? '#78909C' };
  });

  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const weeklyData = weekDays.map((day, i) => ({
    day,
    amount: payments
      .filter(p => {
        const date = parseLocalDate(p.due_date);
        return date?.getDay() === (i + 1) % 7;
      })
      .reduce((sum, p) => sum + p.amount, 0),
  }));

  return { totalExpense, paidCount, pendingCount, overdueCount, categoryBreakdown, weeklyData };
};

export const exportData = async () => {
  const database = await getDatabase();
  const payments = await database.getAllAsync<Payment>('SELECT * FROM payments');
  const debts = await database.getAllAsync<Debt>('SELECT * FROM debts');
  const debtPayments = await database.getAllAsync<DebtPayment>('SELECT * FROM debt_payments');
  const categories = await database.getAllAsync<Category>('SELECT * FROM categories');
  const uploadedIcons = await database.getAllAsync<UploadedIcon>('SELECT * FROM uploaded_icons');
  const subscriptions = await getSubscriptions();
  const settings = await database.getAllAsync<Settings>(
    "SELECT * FROM settings WHERE key NOT IN ('pinCode', 'pinEnabled', 'biometricEnabled', 'notificationPrivacyMigrated', 'automaticBackupEnabled', 'backupDirectoryUri', 'backupDirectoryLabel', 'lastBackupAt', 'lastAutomaticBackupAt')"
  );

  return JSON.stringify({
    format: 'nox-finance-backup',
    version: 5,
    exportedAt: new Date().toISOString(),
    payments,
    debts,
    debtPayments,
    categories,
    uploadedIcons,
    subscriptions,
    settings,
  }, null, 2);
};

export const importData = async (raw: string): Promise<void> => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const payments = parsed.payments;
  const debts = parsed.debts;
  const debtPayments = parsed.debtPayments;
  const categories = parsed.categories;
  const settings = parsed.settings;
  const uploadedIcons = Array.isArray(parsed.uploadedIcons) ? parsed.uploadedIcons : [];
  // Versions before 5 did not contain subscriptions.
  if (parsed.subscriptions !== undefined && !Array.isArray(parsed.subscriptions)) throw new Error('INVALID_BACKUP');
  const subscriptions = (parsed.subscriptions ?? []) as Subscription[];
  for (const item of subscriptions) {
    if (!item || !Number.isInteger(item.id) || item.id <= 0) throw new Error('INVALID_BACKUP');
    validateSubscription(item);
  }

  if (![payments, debts, debtPayments, categories, settings].every(Array.isArray)) {
    throw new Error('INVALID_BACKUP');
  }

  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.execAsync(`
      DELETE FROM debt_payments;
      DELETE FROM debts;
      DELETE FROM payments;
      DELETE FROM categories;
      DELETE FROM uploaded_icons;
      DELETE FROM subscriptions;
    `);

    for (const item of payments as Payment[]) {
      const due = parseLocalDate(item.due_date);
      await transaction.runAsync(
        `INSERT INTO payments (id, name, amount, currency, category, icon_type, icon_value, due_date, due_time, recurrence, status, notes, reminder_days, notification_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
        [item.id, item.name, item.amount, item.currency, item.category, item.icon_type, item.icon_value,
          due ? formatLocalDateKey(due) : item.due_date, item.due_time, item.recurrence, item.status,
          item.notes ?? '', item.reminder_days ?? '[]', item.created_at ?? new Date().toISOString()]
      );
    }

    for (const item of subscriptions) {
      await transaction.runAsync(
        'INSERT INTO subscriptions (id, name, amount, currency, billing_cycle, renewal_date, active, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.name.trim(), item.amount, item.currency, item.billing_cycle, item.renewal_date, item.active, item.notes, item.created_at ?? new Date().toISOString()]
      );
    }

    for (const item of debts as Debt[]) {
      const due = parseLocalDate(item.due_date);
      await transaction.runAsync(
        `INSERT INTO debts (id, person_name, person_photo, icon_type, icon_value, total_amount, paid_amount, currency, debt_direction, due_date, interest_rate, notes, reminder_days, notification_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
        [item.id, item.person_name, item.person_photo ?? '', item.icon_type ?? 'icon', item.icon_value ?? 'account-cash', item.total_amount, item.paid_amount,
          item.currency, item.debt_direction, due ? formatLocalDateKey(due) : '', item.interest_rate ?? 0,
          item.notes ?? '', item.reminder_days ?? '[]', item.created_at ?? new Date().toISOString()]
      );
    }

    for (const item of debtPayments as DebtPayment[]) {
      await transaction.runAsync(
        'INSERT INTO debt_payments (id, debt_id, amount, paid_at, notes) VALUES (?, ?, ?, ?, ?)',
        [item.id, item.debt_id, item.amount, item.paid_at, item.notes ?? '']
      );
    }

    for (const item of categories as Category[]) {
      await transaction.runAsync(
        'INSERT OR IGNORE INTO categories (id, name, icon, color, is_custom) VALUES (?, ?, ?, ?, ?)',
        [item.id, item.name, item.icon, item.color, item.is_custom ? 1 : 0]
      );
    }

    for (const item of uploadedIcons as UploadedIcon[]) {
      if (!item?.uri) continue;
      await transaction.runAsync(
        'INSERT OR IGNORE INTO uploaded_icons (id, uri, name, created_at) VALUES (?, ?, ?, ?)',
        [item.id, item.uri, item.name ?? '', item.created_at ?? new Date().toISOString()]
      );
    }

    const protectedSettings = new Set([
      'pinCode', 'pinEnabled', 'biometricEnabled', 'notificationPrivacyMigrated',
      'automaticBackupEnabled', 'backupDirectoryUri', 'backupDirectoryLabel', 'lastBackupAt', 'lastAutomaticBackupAt',
    ]);
    for (const item of settings as Settings[]) {
      if (!item?.key || protectedSettings.has(item.key)) continue;
      await transaction.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [item.key, String(item.value ?? '')]
      );
    }
  });

  await seedDefaultCategories(database);
  await seedDefaultSettings(database);
};

export const deleteAllData = async (): Promise<void> => {
  const database = await getDatabase();

  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.execAsync(`
      DELETE FROM debt_payments;
      DELETE FROM debts;
      DELETE FROM payments;
      DELETE FROM categories;
      DELETE FROM uploaded_icons;
      DELETE FROM subscriptions;
      DELETE FROM settings;
      DELETE FROM sqlite_sequence
        WHERE name IN ('payments', 'debts', 'debt_payments', 'categories', 'uploaded_icons', 'subscriptions');
    `);
  });

  await seedDefaultCategories(database);
  await seedDefaultSettings(database);
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
};
