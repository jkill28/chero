import axios, { type AxiosRequestConfig } from 'axios';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Transaction, Settings, RemoteSyncConfig } from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'chero_local_transactions',
  SETTINGS: 'chero_local_settings',
  OUTBOX: 'chero_sync_outbox',
  REMOTE_CONFIG: 'chero_remote_config',
};

const DEFAULT_SETTINGS: Settings = {
  currency: 'AUD',
  initialBalance: 0,
  language: 'fr',
  dailyNotificationEnabled: false,
  dailyNotificationTime: '20:00',
};

export type PendingMutation =
  | {
      opId: string;
      type: 'CREATE_TX';
      tempId: number;
      data: Partial<Transaction>;
    }
  | {
      opId: string;
      type: 'UPDATE_TX';
      id: number;
      data: Partial<Transaction>;
    }
  | {
      opId: string;
      type: 'DELETE_TX';
      id: number;
    }
  | {
      opId: string;
      type: 'SAVE_SETTINGS';
      data: Settings;
    };

export function getRemoteSyncConfig(): RemoteSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REMOTE_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read remote sync config', e);
  }
  return {
    serverUrl: '',
    cfAccessClientId: '',
    cfAccessClientSecret: '',
  };
}

export function saveRemoteSyncConfig(config: RemoteSyncConfig): void {
  const normalized: RemoteSyncConfig = {
    serverUrl: config.serverUrl.trim().replace(/\/+$/, ''),
    cfAccessClientId: config.cfAccessClientId?.trim() || '',
    cfAccessClientSecret: config.cfAccessClientSecret?.trim() || '',
  };
  localStorage.setItem(STORAGE_KEYS.REMOTE_CONFIG, JSON.stringify(normalized));
}

export function getEffectiveApiBase(): string | null {
  const config = getRemoteSyncConfig();
  if (config.serverUrl) {
    const base = config.serverUrl.replace(/\/+$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
  }
  // On native Android, if no serverUrl is configured, run in pure standalone local mode
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  // On Web (Docker/Vite), default to relative /api
  return '/api';
}

function getRequestConfig(): AxiosRequestConfig {
  const config = getRemoteSyncConfig();
  const headers: Record<string, string> = {};
  if (config.cfAccessClientId && config.cfAccessClientSecret) {
    headers['CF-Access-Client-Id'] = config.cfAccessClientId;
    headers['CF-Access-Client-Secret'] = config.cfAccessClientSecret;
  }
  return {
    headers,
    timeout: 8000,
  };
}

export function getLocalTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local transactions', e);
  }
  return [];
}

export function setLocalTransactions(txs: Transaction[]): void {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
}

export function getLocalSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse local settings', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function setLocalSettings(settings: Settings): void {
  localStorage.setItem(
    STORAGE_KEYS.SETTINGS,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })
  );
}

export function getOutbox(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OUTBOX);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse sync outbox', e);
  }
  return [];
}

function setOutbox(outbox: PendingMutation[]): void {
  localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
}

function nextLocalId(existing: Transaction[]): number {
  const maxId = existing.reduce((max, tx) => Math.max(max, Math.abs(tx.id)), 0);
  // Use negative IDs when a remote server is configured so we know it was created offline
  const apiBase = getEffectiveApiBase();
  if (apiBase) {
    return -(maxId + 1);
  }
  return maxId + 1;
}

function enqueueMutation(mutation: PendingMutation): void {
  const apiBase = getEffectiveApiBase();
  if (!apiBase) {
    // Pure local mode: no need to queue for remote server
    return;
  }

  const outbox = getOutbox();

  if (mutation.type === 'UPDATE_TX') {
    const createIdx = outbox.findIndex(
      (m) => m.type === 'CREATE_TX' && m.tempId === mutation.id
    );
    if (createIdx !== -1) {
      const existingCreate = outbox[createIdx] as Extract<
        PendingMutation,
        { type: 'CREATE_TX' }
      >;
      outbox[createIdx] = {
        ...existingCreate,
        data: { ...existingCreate.data, ...mutation.data },
      };
      setOutbox(outbox);
      return;
    }
  }

  if (mutation.type === 'DELETE_TX') {
    const createIdx = outbox.findIndex(
      (m) => m.type === 'CREATE_TX' && m.tempId === mutation.id
    );
    if (createIdx !== -1) {
      // Created and deleted while offline: remove creation and any updates for tempId
      const filtered = outbox.filter(
        (m) =>
          !(m.type === 'CREATE_TX' && m.tempId === mutation.id) &&
          !(m.type === 'UPDATE_TX' && m.id === mutation.id)
      );
      setOutbox(filtered);
      return;
    }
  }

  if (mutation.type === 'SAVE_SETTINGS') {
    const filtered: PendingMutation[] = outbox.filter((m) => m.type !== 'SAVE_SETTINGS');
    filtered.push(mutation);
    setOutbox(filtered);
    return;
  }

  outbox.push(mutation);
  setOutbox(outbox);
}

export class CloudflareAuthError extends Error {
  constructor(message = 'Cloudflare Access authentication failed or token expired') {
    super(message);
    this.name = 'CloudflareAuthError';
  }
}

function isAuthError(error: unknown): boolean {
  if (error instanceof CloudflareAuthError) return true;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return true;
    const data = error.response?.data;
    if (
      typeof data === 'string' &&
      (data.includes('cloudflareaccess') ||
        data.includes('CF-Access') ||
        data.includes('<!DOCTYPE') ||
        data.includes('<html'))
    ) {
      return true;
    }
  }
  return false;
}

function assertNotHtmlAuthRedirect(data: unknown): void {
  if (typeof data === 'string') {
    throw new CloudflareAuthError('Received HTML login page instead of JSON API response');
  }
}

export async function flushOutbox(): Promise<{ flushed: boolean; authError: boolean }> {
  const apiBase = getEffectiveApiBase();
  if (!apiBase) return { flushed: true, authError: false };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: false, authError: false };
  }

  const outbox = getOutbox();
  if (outbox.length === 0) return { flushed: true, authError: false };

  const reqConfig = getRequestConfig();
  const idMap = new Map<number, number>();
  const remaining = [...outbox];

  while (remaining.length > 0) {
    const item = remaining[0];
    try {
      if (item.type === 'CREATE_TX') {
        const payload = { ...item.data, id: undefined };
        const res = await axios.post(`${apiBase}/transactions`, payload, reqConfig);
        assertNotHtmlAuthRedirect(res.data);
        if (res.data && typeof res.data.id === 'number') {
          idMap.set(item.tempId, res.data.id);
        } else {
          throw new CloudflareAuthError('Unexpected response format on transaction create');
        }
      } else if (item.type === 'UPDATE_TX') {
        const targetId = idMap.get(item.id) ?? item.id;
        const res = await axios.put(
          `${apiBase}/transactions/${targetId}`,
          { ...item.data, id: targetId },
          reqConfig
        );
        assertNotHtmlAuthRedirect(res.data);
      } else if (item.type === 'DELETE_TX') {
        const targetId = idMap.get(item.id) ?? item.id;
        const res = await axios.delete(`${apiBase}/transactions/${targetId}`, reqConfig);
        assertNotHtmlAuthRedirect(res.data);
      } else if (item.type === 'SAVE_SETTINGS') {
        const res = await axios.post(`${apiBase}/settings`, item.data, reqConfig);
        assertNotHtmlAuthRedirect(res.data);
      }
      remaining.shift();
      setOutbox(remaining);
    } catch (error) {
      console.warn('Outbox flush paused due to error:', error);
      return { flushed: false, authError: isAuthError(error) };
    }
  }

  return { flushed: true, authError: false };
}

export async function syncWithServer(): Promise<{
  transactions: Transaction[];
  settings: Settings;
  synced: boolean;
  isLocalOnly: boolean;
  authError: boolean;
}> {
  const apiBase = getEffectiveApiBase();
  if (!apiBase) {
    return {
      transactions: getLocalTransactions(),
      settings: getLocalSettings(),
      synced: false,
      isLocalOnly: true,
      authError: false,
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      transactions: getLocalTransactions(),
      settings: getLocalSettings(),
      synced: false,
      isLocalOnly: false,
      authError: false,
    };
  }

  try {
    const outboxResult = await flushOutbox();
    if (!outboxResult.flushed) {
      return {
        transactions: getLocalTransactions(),
        settings: getLocalSettings(),
        synced: false,
        isLocalOnly: false,
        authError: outboxResult.authError,
      };
    }

    const reqConfig = getRequestConfig();
    const [txRes, settingsRes] = await Promise.all([
      axios.get(`${apiBase}/transactions`, reqConfig),
      axios.get(`${apiBase}/settings`, reqConfig),
    ]);

    assertNotHtmlAuthRedirect(txRes.data);
    assertNotHtmlAuthRedirect(settingsRes.data);

    if (!Array.isArray(txRes.data)) {
      throw new CloudflareAuthError('Invalid transactions response (intercepted by auth gateway)');
    }

    const localSettings = getLocalSettings();
    const mergedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      ...settingsRes.data,
      // Preserve local notification settings if server didn't return them
      dailyNotificationEnabled:
        settingsRes.data?.dailyNotificationEnabled ?? localSettings.dailyNotificationEnabled ?? false,
      dailyNotificationTime:
        settingsRes.data?.dailyNotificationTime ?? localSettings.dailyNotificationTime ?? '20:00',
    };

    setLocalTransactions(txRes.data);
    setLocalSettings(mergedSettings);

    return {
      transactions: txRes.data,
      settings: mergedSettings,
      synced: true,
      isLocalOnly: false,
      authError: false,
    };
  } catch (error) {
    console.warn('Remote sync unavailable, using local offline data:', error);
    return {
      transactions: getLocalTransactions(),
      settings: getLocalSettings(),
      synced: false,
      isLocalOnly: false,
      authError: isAuthError(error),
    };
  }
}

export async function createTransactionRepo(data: Partial<Transaction>): Promise<Transaction> {
  const current = getLocalTransactions();
  const tempId = nextLocalId(current);
  const newTx: Transaction = {
    id: tempId,
    amount: Number(data.amount ?? 0),
    description: data.description || '',
    date: data.date || new Date().toISOString(),
    recurrence: data.recurrence || 'NONE',
    isAdjustment: !!data.isAdjustment,
    recurrenceInterval: data.recurrenceInterval ? Number(data.recurrenceInterval) : 1,
    recurrenceEndDate: data.recurrenceEndDate || null,
    excludedDates: data.excludedDates || null,
  };

  const updated = [...current, newTx];
  setLocalTransactions(updated);

  enqueueMutation({
    opId: `${Date.now()}-${Math.random()}`,
    type: 'CREATE_TX',
    tempId,
    data: newTx,
  });

  await flushOutbox();
  return newTx;
}

export async function updateTransactionRepo(
  id: number,
  data: Partial<Transaction>
): Promise<Transaction> {
  const current = getLocalTransactions();
  let updatedTx: Transaction | null = null;

  const updated = current.map((tx) => {
    if (tx.id === id) {
      updatedTx = {
        ...tx,
        ...data,
        id,
        amount: data.amount !== undefined ? Number(data.amount) : tx.amount,
        recurrenceInterval:
          data.recurrenceInterval !== undefined
            ? Number(data.recurrenceInterval)
            : tx.recurrenceInterval,
      };
      return updatedTx;
    }
    return tx;
  });

  setLocalTransactions(updated);

  enqueueMutation({
    opId: `${Date.now()}-${Math.random()}`,
    type: 'UPDATE_TX',
    id,
    data: updatedTx || data,
  });

  await flushOutbox();
  return updatedTx || (data as Transaction);
}

export async function deleteTransactionRepo(id: number): Promise<void> {
  const current = getLocalTransactions();
  const updated = current.filter((tx) => tx.id !== id);
  setLocalTransactions(updated);

  enqueueMutation({
    opId: `${Date.now()}-${Math.random()}`,
    type: 'DELETE_TX',
    id,
  });

  await flushOutbox();
}

export async function saveSettingsRepo(settings: Settings): Promise<Settings> {
  setLocalSettings(settings);

  enqueueMutation({
    opId: `${Date.now()}-${Math.random()}`,
    type: 'SAVE_SETTINGS',
    data: settings,
  });

  await flushOutbox();
  return settings;
}

export interface CheroBackupPayload {
  version: number;
  exportedAt: string;
  settings: Settings;
  transactions: Transaction[];
}

export async function exportBackupRepo(): Promise<void> {
  const payload: CheroBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getLocalSettings(),
    transactions: getLocalTransactions(),
  };
  const jsonString = JSON.stringify(payload, null, 2);
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `chero_backup_${datePart}.json`;

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: jsonString,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Chéro Backup',
      url: result.uri,
      dialogTitle: 'Export Chéro Backup',
    });
    return;
  }

  // On Web, if connected to /api and no pending local-only changes, allow downloading JSON backup
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackupRepo(file: File): Promise<void> {
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<CheroBackupPayload>;
    if (!Array.isArray(parsed.transactions)) {
      throw new Error('Invalid JSON backup file');
    }
    const txs = parsed.transactions;
    const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };

    // Replace local state
    setOutbox([]);
    setLocalTransactions(txs);
    setLocalSettings(settings);

    // If a remote server is configured and reachable, sync restored data
    const apiBase = getEffectiveApiBase();
    if (apiBase && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        await axios.post(
          `${apiBase}/restore-json`,
          { transactions: txs, settings },
          getRequestConfig()
        );
        await syncWithServer();
      } catch (e) {
        console.warn('Offline JSON restore applied locally; remote sync skipped:', e);
      }
    }
    return;
  }

  // Fallback for legacy .db SQLite files when connected to a server
  const apiBase = getEffectiveApiBase();
  if (!apiBase) {
    throw new Error('SQLite .db restore requires an active server connection. Use .json backup for offline restore.');
  }

  const formData = new FormData();
  formData.append('backup', file);
  const reqConfig = getRequestConfig();
  await axios.post(`${apiBase}/restore`, formData, {
    ...reqConfig,
    headers: {
      ...reqConfig.headers,
      'Content-Type': 'multipart/form-data',
    },
  });
  await syncWithServer();
}
