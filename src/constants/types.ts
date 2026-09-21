export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';
export type RecurrenceType = 'once' | 'weekly' | 'monthly' | 'yearly';
export type PaymentStatus = 'pending' | 'paid' | 'overdue';
export type DebtDirection = 'owe' | 'owed';
export type IconType = 'gallery' | 'emoji' | 'icon';
export type DebtStatus = 'ontime' | 'approaching' | 'overdue';
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type BackupDestination = 'device' | 'google-drive' | 'dropbox' | 'onedrive' | 'share';

export type SubscriptionCycle = 'weekly' | 'monthly' | 'yearly';
export interface Subscription {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  billing_cycle: SubscriptionCycle;
  renewal_date: string;
  active: number;
  notes: string;
  created_at: string;
}
export type SubscriptionInput = Omit<Subscription, 'id' | 'created_at'>;

export interface UploadedIcon {
  id: number;
  uri: string;
  name: string;
  created_at: string;
}

export interface Payment {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  icon_type: IconType;
  icon_value: string;
  due_date: string; 
  due_time: string; 
  recurrence: RecurrenceType;
  status: PaymentStatus;
  notes: string;
  reminder_days: string;
  notification_id: string;
  created_at: string;
}

export interface Debt {
  id: number;
  person_name: string;
  person_photo: string;
  icon_type: IconType;
  icon_value: string;
  total_amount: number;
  paid_amount: number;
  currency: Currency;
  debt_direction: DebtDirection;
  due_date: string;
  interest_rate: number;
  notes: string;
  reminder_days: string;
  notification_ids: string; 
  created_at: string;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  amount: number;
  paid_at: string;
  notes: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_custom: boolean;
}

export interface Settings {
  key: string;
  value: string;
}

export interface AppSettings {
  userName: string;
  profilePhoto: string;
  defaultCurrency: Currency;
  theme: 'dark' | 'light' | 'system';
  notificationsEnabled: boolean;
  defaultReminderDays: number[];
  dailySummaryTime: string;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  onboardingCompleted: boolean;
  autoLockMinutes: number;
  automaticBackupEnabled: boolean;
  backupFrequency: BackupFrequency;
  backupDestination: BackupDestination;
  backupDirectoryUri: string;
  backupDirectoryLabel: string;
  lastBackupAt: string;
}

export interface MonthlyStats {
  totalExpense: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  categoryBreakdown: { category: string; amount: number; color: string }[];
  weeklyData: { day: string; amount: number }[];
}
