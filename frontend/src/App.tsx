import { useState, useEffect, useMemo, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, startOfDay, isSameDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Calendar } from './components/Calendar';
import { TransactionModal } from './components/TransactionModal';
import { SettingsModal } from './components/SettingsModal';
import type { Transaction, Settings, ThemeMode, RemoteSyncConfig, SyncStatus } from './types';
import { getDailyBalances } from './lib/balance';
import {
  Settings as SettingsIcon,
  Plus,
  Download,
  Upload,
  Monitor,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  RefreshCw,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';
import { t } from './lib/i18n';
import { cn, formatCurrency } from './lib/utils';
import {
  getLocalTransactions,
  getLocalSettings,
  getRemoteSyncConfig,
  saveRemoteSyncConfig,
  getOutbox,
  syncWithServer,
  createTransactionRepo,
  updateTransactionRepo,
  deleteTransactionRepo,
  saveSettingsRepo,
  exportBackupRepo,
  importBackupRepo,
} from './lib/storage';
import {
  syncDailyNotification,
  registerNotificationTapListener,
} from './lib/notifications';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>(() => getLocalTransactions());
  const [settings, setSettings] = useState<Settings>(() => getLocalSettings());
  const [remoteConfig, setRemoteConfig] = useState<RemoteSyncConfig>(() => getRemoteSyncConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const [pendingCount, setPendingCount] = useState<number>(() => getOutbox().length);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chero_theme') as ThemeMode;
    if (saved === 'system' || saved === 'dark' || saved === 'white') return saved;
    return 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (Capacitor.isNativePlatform() && !root.style.getPropertyValue('--safe-area-top')) {
      root.style.setProperty('--safe-area-top', '36px');
      root.style.setProperty('--safe-area-bottom', '20px');
    }
    const syncNativeSystemBarsTheme = (isLightAppearance: boolean) => {
      const win = window as Window & {
        CheroNative?: { setSystemBarsLightAppearance?: (isLight: boolean) => void };
      };
      try {
        win.CheroNative?.setSystemBarsLightAppearance?.(isLightAppearance);
      } catch {
        // Ignore if bridge not ready
      }
    };
    const applyTheme = (mode: ThemeMode) => {
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        syncNativeSystemBarsTheme(false);
      } else if (mode === 'white') {
        root.classList.add('light');
        root.classList.remove('dark');
        syncNativeSystemBarsTheme(true);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
          root.classList.remove('light');
          syncNativeSystemBarsTheme(false);
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
          syncNativeSystemBarsTheme(true);
        }
      }
    };

    applyTheme(themeMode);
    localStorage.setItem('chero_theme', themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (themeMode === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  const performSync = useCallback(async () => {
    setSyncStatus('syncing');
    const result = await syncWithServer();
    setTransactions(result.transactions);
    setSettings(result.settings);
    setPendingCount(getOutbox().length);

    if (result.isLocalOnly) {
      setSyncStatus('local-only');
    } else if (result.synced) {
      setSyncStatus('synced');
    } else if (result.authError) {
      setSyncStatus('auth-error');
    } else {
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    performSync();

    const handleOnline = () => {
      performSync();
    };
    const handleOffline = () => {
      setSyncStatus((prev) => (prev === 'local-only' ? 'local-only' : 'offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  // Register listener for tapping the daily reminder notification on Android
  useEffect(() => {
    const cleanup = registerNotificationTapListener(() => {
      const today = new Date();
      setCurrentDate(today);
      setSelectedDate(today);
      setSelectedTransaction(null);
      setIsModalOpen(true);
    });
    return cleanup;
  }, []);

  // Register Android back button / gesture handler for closing modals or double-back to exit
  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const win = window as Window & { __cheroHandleBack?: () => string };

    win.__cheroHandleBack = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
        return 'MODAL_CLOSED';
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return 'MODAL_CLOSED';
      }
      setShowExitToast(true);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        setShowExitToast(false);
      }, 2000);
      return 'TOAST_SHOWN';
    };

    return () => {
      delete win.__cheroHandleBack;
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [isModalOpen, isSettingsOpen]);

  // Ensure daily notification schedule matches saved settings on app launch
  useEffect(() => {
    syncDailyNotification(settings).catch(console.error);
    // Only run on initial mount; subsequent updates are handled in handleSaveSettings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFromLocalAndSync = useCallback(async () => {
    setTransactions(getLocalTransactions());
    setPendingCount(getOutbox().length);
    await performSync();
  }, [performSync]);

  const todayBalance = useMemo(() => {
    const today = startOfDay(new Date());
    const { balances: allBalances } = getDailyBalances(transactions, settings.initialBalance, today, today);
    const dateKey = format(today, 'yyyy-MM-dd');
    return allBalances[dateKey] ?? settings.initialBalance;
  }, [transactions, settings.initialBalance]);

  const formattedDate = useMemo(() => {
    const today = new Date();
    const locale = settings.language === 'en' ? enUS : fr;
    const str = format(today, 'EEEE do MMMM yyyy', { locale });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [settings.language]);

  const { balances, dailyTransactions } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return getDailyBalances(transactions, settings.initialBalance, startDate, endDate);
  }, [transactions, settings, currentDate]);

  const selectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const selectedDayBalance = useMemo(() => {
    return balances[selectedDateKey] ?? settings.initialBalance;
  }, [balances, selectedDateKey, settings.initialBalance]);

  const selectedDayTransactions = useMemo(() => {
    return dailyTransactions[selectedDateKey] || [];
  }, [dailyTransactions, selectedDateKey]);

  const selectedDayNet = useMemo(() => {
    return selectedDayTransactions
      .filter((t) => !t.transaction.isAdjustment)
      .reduce((sum, t) => sum + t.transaction.amount, 0);
  }, [selectedDayTransactions]);

  const handleDayClick = (date: Date) => {
    const isAlreadySelected = isSameDay(date, selectedDate);
    setSelectedDate(date);
    setSelectedTransaction(null);
    if (isAlreadySelected) {
      setIsModalOpen(true);
    }
  };

  const handleTransactionClick = (tx: Transaction, occurrenceDate: string) => {
    setSelectedTransaction(tx);
    setSelectedDate(new Date(occurrenceDate));
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (data: Partial<Transaction>) => {
    try {
      if (data.id) {
        await updateTransactionRepo(data.id, data);
      } else {
        await createTransactionRepo(data);
      }
      setIsModalOpen(false);
      await refreshFromLocalAndSync();
    } catch (error) {
      console.error('Failed to save transaction', error);
    }
  };

  const handleSaveTransactionComplex = async (data: Partial<Transaction>, mode: 'single' | 'future') => {
    if (!selectedTransaction) return;
    try {
      if (mode === 'single') {
        const excluded = selectedTransaction.excludedDates ? selectedTransaction.excludedDates.split(',') : [];
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        if (!excluded.includes(dateStr)) {
          excluded.push(dateStr);
        }
        await updateTransactionRepo(selectedTransaction.id, {
          ...selectedTransaction,
          excludedDates: excluded.join(','),
        });
        await createTransactionRepo({
          ...data,
          id: undefined,
          recurrence: 'NONE',
          recurrenceInterval: 1,
          recurrenceEndDate: null,
          excludedDates: null,
        });
      } else {
        const originalDateStr = format(new Date(selectedTransaction.date), 'yyyy-MM-dd');
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        if (originalDateStr === selectedDateStr) {
          await updateTransactionRepo(selectedTransaction.id, data);
        } else {
          const prevDay = new Date(selectedDate);
          prevDay.setDate(prevDay.getDate() - 1);
          await updateTransactionRepo(selectedTransaction.id, {
            ...selectedTransaction,
            recurrenceEndDate: prevDay.toISOString(),
          });
          await createTransactionRepo({
            ...data,
            id: undefined,
          });
        }
      }
      setIsModalOpen(false);
      await refreshFromLocalAndSync();
    } catch (error) {
      console.error('Failed complex save', error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      await deleteTransactionRepo(id);
      setIsModalOpen(false);
      await refreshFromLocalAndSync();
    } catch (error) {
      console.error('Failed to delete transaction', error);
    }
  };

  const handleDeleteTransactionComplex = async (id: number, mode: 'single' | 'future' | 'all') => {
    if (!selectedTransaction) return;
    try {
      if (mode === 'single') {
        const excluded = selectedTransaction.excludedDates ? selectedTransaction.excludedDates.split(',') : [];
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        if (!excluded.includes(dateStr)) {
          excluded.push(dateStr);
        }
        await updateTransactionRepo(id, {
          ...selectedTransaction,
          excludedDates: excluded.join(','),
        });
      } else if (mode === 'future') {
        const prevDay = new Date(selectedDate);
        prevDay.setDate(prevDay.getDate() - 1);
        await updateTransactionRepo(id, {
          ...selectedTransaction,
          recurrenceEndDate: prevDay.toISOString(),
        });
      } else {
        await deleteTransactionRepo(id);
      }
      setIsModalOpen(false);
      await refreshFromLocalAndSync();
    } catch (error) {
      console.error('Failed complex delete', error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      saveRemoteSyncConfig(remoteConfig);

      let updatedSettings = { ...settings };
      const notifOk = await syncDailyNotification(updatedSettings);
      if (!notifOk && updatedSettings.dailyNotificationEnabled) {
        alert(t(updatedSettings.language, 'notificationPermissionDenied'));
        updatedSettings = { ...updatedSettings, dailyNotificationEnabled: false };
        setSettings(updatedSettings);
      }

      await saveSettingsRepo(updatedSettings);
      setIsSettingsOpen(false);
      await performSync();
    } catch (error) {
      console.error('Failed to save settings', error);
    }
  };

  const handleBackup = async () => {
    try {
      await exportBackupRepo();
    } catch (error) {
      console.error('Backup failed', error);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importBackupRepo(file);
      setTransactions(getLocalTransactions());
      setSettings(getLocalSettings());
      alert(t(settings.language, 'restoreSuccess'));
      await performSync();
    } catch (error) {
      console.error('Restore failed', error);
      alert(t(settings.language, 'restoreError'));
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-m3-surface text-m3-on-surface px-3 sm:px-6 app-safe-area transition-colors font-sans">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

        {/* Centered App Name positioned safely below Pixel camera cutout */}
        <header className="text-center pt-1 pb-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-m3-on-surface">
            {t(settings.language, 'title')}
          </h1>
        </header>

        {/* Cloudflare Service Token Expired / Auth Error Banner */}
        {syncStatus === 'auth-error' && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <ShieldAlert size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium">
                {t(settings.language, 'cfTokenExpiredBanner')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="self-start sm:self-auto shrink-0 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-2xs"
            >
              {t(settings.language, 'updateTokenInSettings')}
            </button>
          </div>
        )}

        {/* 1. TOP: Current Balance Card with Slim Border */}
        <div className="bg-m3-surface-container border border-m3-card-border rounded-3xl p-5 sm:p-6 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">
                  {t(settings.language, 'currentBalance')}
                </span>
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    syncStatus === 'auth-error'
                      ? "bg-rose-500 animate-pulse"
                      : syncStatus === 'offline' || syncStatus === 'error'
                        ? "bg-amber-500"
                        : "bg-emerald-500 animate-pulse"
                  )}
                />
                <span className="text-xs text-m3-on-surface-variant font-medium hidden sm:inline">
                  • {formattedDate}
                </span>

                {/* Sync / Offline Status Pill */}
                <button
                  type="button"
                  onClick={() => (syncStatus === 'auth-error' ? setIsSettingsOpen(true) : performSync())}
                  title={
                    syncStatus === 'auth-error'
                      ? t(settings.language, 'updateTokenInSettings')
                      : t(settings.language, 'syncNow')
                  }
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                    syncStatus === 'synced' &&
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                    syncStatus === 'syncing' &&
                      "bg-m3-primary/10 text-m3-primary border-m3-primary/20",
                    syncStatus === 'local-only' &&
                      "bg-m3-surface-container-high text-m3-on-surface-variant border-m3-card-border",
                    (syncStatus === 'offline' || syncStatus === 'error') &&
                      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
                    syncStatus === 'auth-error' &&
                      "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  )}
                >
                  {syncStatus === 'synced' && <Cloud size={12} />}
                  {syncStatus === 'syncing' && <RefreshCw size={12} className="animate-spin" />}
                  {syncStatus === 'local-only' && <HardDrive size={12} />}
                  {(syncStatus === 'offline' || syncStatus === 'error') && <CloudOff size={12} />}
                  {syncStatus === 'auth-error' && <ShieldAlert size={12} />}
                  <span>
                    {syncStatus === 'synced' && t(settings.language, 'syncStatusSynced')}
                    {syncStatus === 'syncing' && t(settings.language, 'syncStatusSyncing')}
                    {syncStatus === 'local-only' && t(settings.language, 'syncStatusLocal')}
                    {(syncStatus === 'offline' || syncStatus === 'error') &&
                      t(settings.language, 'syncStatusOffline')}
                    {syncStatus === 'auth-error' && t(settings.language, 'syncStatusAuthError')}
                    {pendingCount > 0 &&
                      ` (${t(settings.language, 'pendingChanges').replace('{n}', String(pendingCount))})`}
                  </span>
                </button>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-4xl font-black text-m3-on-surface tracking-tight">
                  {formatCurrency(todayBalance, settings.currency, settings.language)}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-card-border">
                  {settings.currency}
                </span>
              </div>
              <p className="text-xs text-m3-on-surface-variant mt-1 sm:hidden">
                {formattedDate}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-stretch sm:self-auto">
              {/* 3-way Theme Toggle: ICONS ONLY (no text) */}
              <div className="flex items-center bg-m3-surface-container-high rounded-xl border border-m3-card-border p-1 gap-1" role="group" aria-label={t(settings.language, 'theme')}>
                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    themeMode === 'system'
                      ? "bg-m3-surface text-m3-primary shadow-xs"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface"
                  )}
                  title={t(settings.language, 'systemTheme')}
                  aria-label={t(settings.language, 'systemTheme')}
                >
                  <Monitor size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    themeMode === 'dark'
                      ? "bg-m3-surface text-m3-primary shadow-xs"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface"
                  )}
                  title={t(settings.language, 'darkTheme')}
                  aria-label={t(settings.language, 'darkTheme')}
                >
                  <Moon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('white')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    themeMode === 'white'
                      ? "bg-m3-surface text-m3-primary shadow-xs"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface"
                  )}
                  title={t(settings.language, 'whiteTheme')}
                  aria-label={t(settings.language, 'whiteTheme')}
                >
                  <Sun size={16} />
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedTransaction(null);
                  setSelectedDate(new Date());
                  setIsModalOpen(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-m3-primary hover:brightness-110 text-m3-on-primary font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all"
                title={t(settings.language, 'addTransaction')}
              >
                <Plus size={18} />
                <span>{t(settings.language, 'addTransaction')}</span>
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                title={t(settings.language, 'settings')}
                className="p-2.5 bg-m3-surface-container-high text-m3-on-surface rounded-xl border border-m3-card-border hover:bg-m3-on-surface/10 transition-colors shadow-2xs"
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE: Calendar */}
        <main className="space-y-4 sm:space-y-6">
          <Calendar
            currentDate={currentDate}
            selectedDate={selectedDate}
            onDateChange={setCurrentDate}
            onDayClick={handleDayClick}
            onTransactionClick={handleTransactionClick}
            balances={balances}
            dailyTransactions={dailyTransactions}
            currency={settings.currency}
            language={settings.language}
          />

          {/* 3. BOTTOM: Selected Day Transactions Card with Slim Border */}
          <div className="bg-m3-surface-container rounded-3xl border border-m3-card-border p-5 sm:p-6 shadow-sm transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-m3-card-border gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-m3-on-surface capitalize">
                    {format(selectedDate, 'EEEE do MMMM yyyy', { locale: settings.language === 'en' ? enUS : fr })}
                  </h3>
                  {isSameDay(selectedDate, new Date()) && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-m3-primary/10 text-m3-primary border border-m3-primary/20">
                      {t(settings.language, 'today')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-m3-on-surface-variant mt-1">
                  <span>{t(settings.language, 'projectedBalance')}: </span>
                  <strong className={cn(
                    "font-bold",
                    selectedDayBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatCurrency(selectedDayBalance, settings.currency, settings.language)}
                  </strong>
                  {selectedDayTransactions.length > 0 && (
                    <span className="ml-2">
                      ({t(settings.language, 'dailyNet')}: <strong className={selectedDayNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {selectedDayNet > 0 ? '+' : ''}{formatCurrency(selectedDayNet, settings.currency, settings.language)}
                      </strong>)
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedTransaction(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-bold bg-m3-primary text-m3-on-primary hover:brightness-110 px-4 py-2.5 rounded-xl shadow-2xs transition-all"
              >
                <Plus size={16} />
                <span>{t(settings.language, 'addOnThisDay')}</span>
              </button>
            </div>

            <div className="mt-3 divide-y divide-m3-card-border">
              {selectedDayTransactions.length ? (
                selectedDayTransactions.map((occ, idx) => (
                  <div
                    key={`${occ.transaction.id}-${idx}`}
                    onClick={() => handleTransactionClick(occ.transaction, occ.date)}
                    className="py-3 px-2 flex justify-between items-center hover:bg-m3-on-surface/5 cursor-pointer rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm",
                        occ.transaction.isAdjustment
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : occ.transaction.amount >= 0
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      )}>
                        {occ.transaction.isAdjustment ? '=' : (occ.transaction.amount >= 0 ? '+' : '-')}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                          {occ.transaction.description}
                        </span>
                        <span className="text-xs text-m3-on-surface-variant font-medium mt-0.5">
                          {occ.transaction.isAdjustment
                            ? t(settings.language, 'adjustment')
                            : (occ.transaction.amount >= 0 ? t(settings.language, 'income') : t(settings.language, 'expense'))}
                          {occ.transaction.recurrence !== 'NONE' && ' • ' + t(settings.language, 'recurring')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-sm font-bold block",
                        occ.transaction.isAdjustment
                          ? "text-amber-600 dark:text-amber-400"
                          : (occ.transaction.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")
                      )}>
                        {occ.transaction.isAdjustment ? '=' : (occ.transaction.amount > 0 ? '+' : '')}
                        {formatCurrency(occ.transaction.amount, settings.currency, settings.language)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-m3-on-surface-variant text-xs italic">
                  {t(settings.language, 'noTransactions')}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="mt-6 sm:mt-10 text-center text-m3-on-surface-variant/70 text-xs font-medium pb-6 flex flex-col items-center gap-3">
          <p>{t(settings.language, 'footer')}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackup}
              className="flex items-center gap-1.5 hover:text-m3-primary transition-colors px-3 py-1.5 rounded-xl hover:bg-m3-primary/10"
            >
              <Download size={14} />
              <span>{t(settings.language, 'backup')}</span>
            </button>
            <label className="flex items-center gap-1.5 hover:text-m3-primary transition-colors cursor-pointer px-3 py-1.5 rounded-xl hover:bg-m3-primary/10">
              <Upload size={14} />
              <span>{t(settings.language, 'restore')}</span>
              <input
                type="file"
                accept=".json,.db"
                className="hidden"
                onChange={handleRestore}
              />
            </label>
          </div>
        </footer>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        onSaveComplex={handleSaveTransactionComplex}
        onDelete={handleDeleteTransaction}
        onDeleteComplex={handleDeleteTransactionComplex}
        transaction={selectedTransaction}
        selectedDate={selectedDate}
        language={settings.language}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        remoteConfig={remoteConfig}
        setRemoteConfig={setRemoteConfig}
        onSave={handleSaveSettings}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />

      {showExitToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-m3-on-surface text-m3-surface px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg animate-in fade-in duration-150 pointer-events-none">
          {t(settings.language, 'pressBackAgainToExit')}
        </div>
      )}
    </div>
  );
}

export default App;
