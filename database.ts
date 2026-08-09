import * as SQLite from 'expo-sqlite';
import { Payment, Debt, DebtPayment, Category, Settings, AppSettings, Currency } from '../constants/types';

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
      notification_id TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      person_photo TEXT DEFAULT '',
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'TRY',
      debt_direction TEXT NOT NULL DEFAULT 'owe',
      due_date TEXT NOT NULL,
      interest_rate REAL DEFAULT 0,
      notes TEXT DEFAULT '',
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
  `);

  // Varsayılan kategorileri ekle
  await seedDefaultCategories(database);

  // Varsayılan ayarları ekle
  await seedDefaultSettings(database);
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
    { key: 'notificationsEnabled', value: 'true' },
    { key: 'defaultReminderDays', value: '3' },
    { key: 'dailySummaryTime', value: '08:00' },
    { key: 'pinEnabled', value: 'false' },
    { key: 'biometricEnabled', value: 'false' },
    { key: 'onboardingCompleted', value: 'false' },
  ];

  for (const setting of defaults) {
    await database.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
};

// ============================================================
// PAYMENTS
// ============================================================

export const getPayments = async (): Promise<Payment[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Payment>('SELECT * FROM payments ORDER BY due_date ASC');
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
  const today = new Date().toISOString().split('T')[0];
  return await database.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE due_date >= ? AND status != 'paid' ORDER BY due_date ASC LIMIT ?",
    [today, limit]
  );
};

export const addPayment = async (payment: Omit<Payment, 'id' | 'created_at'>): Promise<number> => {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO payments (name, amount, currency, category, icon_type, icon_value, due_date, due_time, recurrence, status, notes, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.name, payment.amount, payment.currency, payment.category,
      payment.icon_type, payment.icon_value, payment.due_date, payment.due_time,
      payment.recurrence, payment.status, payment.notes, payment.notification_id,
    ]
  );
  return result.lastInsertRowId;
};

export const updatePaymentStatus = async (id: number, status: string): Promise<void> => {
  const database = await getDatabase();
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

// ============================================================
// DEBTS
// ============================================================

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
    `INSERT INTO debts (person_name, person_photo, total_amount, paid_amount, currency, debt_direction, due_date, interest_rate, notes, notification_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      debt.person_name, debt.person_photo, debt.total_amount, debt.paid_amount,
      debt.currency, debt.debt_direction, debt.due_date, debt.interest_rate,
      debt.notes, debt.notification_ids,
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

// ============================================================
// CATEGORIES
// ============================================================

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

// ============================================================
// SETTINGS
// ============================================================

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

export const getAllSettings = async (): Promise<AppSettings> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Settings>('SELECT * FROM settings');
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    userName: map.userName ?? 'Kullanıcı',
    profilePhoto: map.profilePhoto ?? '',
    defaultCurrency: (map.defaultCurrency ?? 'TRY') as Currency,
    theme: (map.theme ?? 'dark') as 'dark' | 'light' | 'system',
    notificationsEnabled: map.notificationsEnabled === 'true',
    defaultReminderDays: parseInt(map.defaultReminderDays ?? '3'),
    dailySummaryTime: map.dailySummaryTime ?? '08:00',
    pinEnabled: map.pinEnabled === 'true',
    biometricEnabled: map.biometricEnabled === 'true',
    onboardingCompleted: map.onboardingCompleted === 'true',
  };
};

// ============================================================
// STATS
// ============================================================

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
        const d = new Date(p.due_date);
        return d.getDay() === (i + 1) % 7;
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
  const settings = await database.getAllAsync<Settings>('SELECT * FROM settings');

  return JSON.stringify({ payments, debts, debtPayments, categories, settings }, null, 2);
};
