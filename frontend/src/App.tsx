import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, startOfDay, isSameDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Calendar } from './components/Calendar';
import { TransactionModal } from './components/TransactionModal';
import { SettingsModal } from './components/SettingsModal';
import type { Transaction, Settings, ThemeMode } from './types';
import { getDailyBalances } from './lib/balance';
import { Settings as SettingsIcon, Plus, Download, Upload, Monitor, Moon, Sun } from 'lucide-react';
import { t } from './lib/i18n';
import { cn, formatCurrency } from './lib/utils';

const API_BASE = '/api';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: 'AUD', initialBalance: 0, language: 'fr' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chero_theme') as ThemeMode;
    if (saved === 'system' || saved === 'dark' || saved === 'white') return saved;
    return 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (mode: ThemeMode) => {
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else if (mode === 'white') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        // system mode: match prefers-color-scheme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
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

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/transactions`);
      setTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings`);
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions();
    fetchSettings();
  }, [fetchTransactions, fetchSettings]);

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
        await axios.put(`${API_BASE}/transactions/${data.id}`, data);
      } else {
        await axios.post(`${API_BASE}/transactions`, data);
      }
      fetchTransactions();
      setIsModalOpen(false);
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
        await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, {
          ...selectedTransaction,
          excludedDates: excluded.join(',')
        });
        await axios.post(`${API_BASE}/transactions`, {
          ...data,
          id: undefined,
          recurrence: 'NONE',
          recurrenceInterval: 1,
          recurrenceEndDate: null,
          excludedDates: null
        });
      } else {
        const originalDateStr = format(new Date(selectedTransaction.date), 'yyyy-MM-dd');
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        if (originalDateStr === selectedDateStr) {
          await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, data);
        } else {
          const prevDay = new Date(selectedDate);
          prevDay.setDate(prevDay.getDate() - 1);
          await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, {
            ...selectedTransaction,
            recurrenceEndDate: prevDay.toISOString()
          });
          await axios.post(`${API_BASE}/transactions`, {
            ...data,
            id: undefined
          });
        }
      }
      fetchTransactions();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed complex save', error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/transactions/${id}`);
      fetchTransactions();
      setIsModalOpen(false);
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
        await axios.put(`${API_BASE}/transactions/${id}`, {
          ...selectedTransaction,
          excludedDates: excluded.join(',')
        });
      } else if (mode === 'future') {
        const prevDay = new Date(selectedDate);
        prevDay.setDate(prevDay.getDate() - 1);
        await axios.put(`${API_BASE}/transactions/${id}`, {
          ...selectedTransaction,
          recurrenceEndDate: prevDay.toISOString()
        });
      } else {
        await axios.delete(`${API_BASE}/transactions/${id}`);
      }
      fetchTransactions();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed complex delete', error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/settings`, settings);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save settings', error);
    }
  };

  const handleBackup = () => {
    window.location.href = `${API_BASE}/backup`;
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('backup', file);

    try {
      await axios.post(`${API_BASE}/restore`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert(t(settings.language, 'restoreSuccess'));
      window.location.reload();
    } catch (error) {
      console.error('Restore failed', error);
      alert(t(settings.language, 'restoreError'));
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-m3-surface text-m3-on-surface p-3 sm:p-6 transition-colors font-sans">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

        {/* Centered App Name above all cards */}
        <header className="text-center pt-2 pb-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-m3-on-surface">
            {t(settings.language, 'title')}
          </h1>
        </header>

        {/* 1. TOP: Current Balance Card with Slim Border */}
        <div className="bg-m3-surface-container border border-m3-card-border rounded-3xl p-5 sm:p-6 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">
                  {t(settings.language, 'currentBalance')}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-m3-on-surface-variant font-medium hidden sm:inline">
                  • {formattedDate}
                </span>
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
                accept=".db"
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
        onSave={handleSaveSettings}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    </div>
  );
}

export default App;
