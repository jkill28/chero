export type Recurrence = 'NONE' | 'WEEKLY' | 'MONTHLY';
export type ThemeMode = 'system' | 'dark' | 'white';
export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'local-only' | 'error';

export interface Transaction {
  id: number;
  amount: number;
  description: string;
  date: string;
  recurrence: Recurrence;
  isAdjustment?: boolean;
  recurrenceInterval: number;
  recurrenceEndDate?: string | null;
  excludedDates?: string | null;
}

export interface TransactionOccurrence {
  transaction: Transaction;
  date: string;
}

export interface Settings {
  currency: string;
  initialBalance: number;
  language: string;
  dailyNotificationEnabled?: boolean;
  dailyNotificationTime?: string;
}

export interface RemoteSyncConfig {
  serverUrl: string;
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
}
