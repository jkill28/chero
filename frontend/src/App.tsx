import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, startOfDay, isSameDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Calendar } from './components/Calendar';
import { TransactionModal } from './components/TransactionModal';
import { SettingsModal } from './components/SettingsModal';
import type { Transaction, Settings } from './types';
import { getDailyBalances } from './lib/balance';
import { Settings as SettingsIcon, Plus, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');

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
    const str = format(today, 'EEEE do MMM', { locale });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [settings.language]);

  const { balances, dailyTransactions } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return getDailyBalances(transactions, settings.initialBalance, startDate, endDate);
  }, [transactions, settings, currentDate]);

  const handleDayClick = (date: Date) => {
    const isAlreadySelected = isSameDay(date, selectedDate);
    setSelectedDate(date);
    setSelectedTransaction(null);
    if (window.innerWidth >= 640 || isAlreadySelected) {
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
        // Exclude this date from original
        const excluded = selectedTransaction.excludedDates ? selectedTransaction.excludedDates.split(',') : [];
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        if (!excluded.includes(dateStr)) {
          excluded.push(dateStr);
        }
        await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, {
          ...selectedTransaction,
          excludedDates: excluded.join(',')
        });
        // Create new one-off
        await axios.post(`${API_BASE}/transactions`, {
          ...data,
          id: undefined,
          recurrence: 'NONE',
          recurrenceInterval: 1,
          recurrenceEndDate: null,
          excludedDates: null
        });
      } else {
        // Future mode
        const originalDateStr = format(new Date(selectedTransaction.date), 'yyyy-MM-dd');
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        if (originalDateStr === selectedDateStr) {
          // Just update the original
          await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, data);
        } else {
          // Split: update original end date
          const prevDay = new Date(selectedDate);
          prevDay.setDate(prevDay.getDate() - 1);
          await axios.put(`${API_BASE}/transactions/${selectedTransaction.id}`, {
            ...selectedTransaction,
            recurrenceEndDate: prevDay.toISOString()
          });
          // Create new series
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

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerSearch = searchTerm.toLowerCase();
    return transactions.filter(tx =>
      tx.description.toLowerCase().includes(lowerSearch) ||
      tx.amount.toString().includes(lowerSearch)
    );
  }, [transactions, searchTerm]);

  return (
    <div className="min-h-screen bg-m3-surface text-m3-on-surface p-3 sm:p-8 transition-colors">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-row justify-between items-center mb-2 sm:mb-10 gap-2">
          <div className="flex flex-row items-baseline gap-2">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-m3-primary leading-tight">{t(settings.language, 'title')}</h1>
            <p className="text-[10px] sm:text-sm text-m3-on-surface-variant font-medium opacity-80 whitespace-nowrap">
              <span className="hidden sm:inline">{formattedDate} </span>
              (<span className="sm:hidden">{formatCurrency(todayBalance, settings.currency, settings.language, true)}</span>
              <span className="hidden sm:inline">{formatCurrency(todayBalance, settings.currency, settings.language)}</span>)
            </p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => {
                setSelectedTransaction(null);
                setSelectedDate(new Date());
                setIsModalOpen(true);
              }}
              className="bg-m3-primary-container text-m3-on-primary-container p-2.5 sm:px-6 sm:py-4 rounded-m3-lg hover:shadow-lg flex items-center text-sm sm:text-base font-semibold transition-all"
              title={t(settings.language, 'addTransaction')}
            >
              <Plus size={20} className="sm:mr-2" />
              <span className="hidden sm:inline">{t(settings.language, 'addTransaction')}</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title={t(settings.language, 'settings')}
              className="p-2.5 sm:p-4 bg-m3-surface-container-high text-m3-on-surface rounded-m3-lg border border-m3-outline/20 hover:bg-m3-surface-container transition-colors shadow-sm"
            >
              <SettingsIcon size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </header>

        <main className="space-y-4 sm:space-y-8">
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

          {/* Mobile Operations List - Redesigned for M3 */}
          <div className="mt-4 sm:hidden bg-m3-surface-container rounded-m3-xl shadow-md overflow-hidden">
            <div className="px-5 py-3 border-b border-m3-outline/10 flex justify-between items-center">
              <h3 className="text-base font-bold text-m3-on-surface capitalize">
                {format(selectedDate, 'EEEE do MMMM', { locale: settings.language === 'en' ? enUS : fr })}
              </h3>
            </div>
            <div className="divide-y divide-m3-outline/5 px-1.5">
              {dailyTransactions[format(selectedDate, 'yyyy-MM-dd')]?.length ? (
                dailyTransactions[format(selectedDate, 'yyyy-MM-dd')].map((occ, idx) => (
                  <div
                    key={`${occ.transaction.id}-${idx}`}
                    onClick={() => handleTransactionClick(occ.transaction, occ.date)}
                    className="px-3 py-3 flex justify-between items-center hover:bg-m3-on-surface/5 cursor-pointer rounded-xl transition-colors m-0.5"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-m3-on-surface">{occ.transaction.description}</span>
                      <span className="text-[10px] text-m3-on-surface-variant font-medium mt-0.5">
                        {occ.transaction.amount >= 0 ? t(settings.language, 'income') : t(settings.language, 'expense')}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      occ.transaction.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {occ.transaction.amount > 0 ? '+' : ''}{formatCurrency(occ.transaction.amount, settings.currency, settings.language, true)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-m3-on-surface-variant text-[11px] font-medium italic">
                  {t(settings.language, 'noTransactions')}
                </div>
              )}
            </div>
          </div>

          {/* Search Section */}
          <div className="bg-m3-surface-container rounded-m3-xl shadow-md overflow-hidden">
            <div className="px-5 py-3 border-b border-m3-outline/10">
              <h3 className="text-base font-bold text-m3-on-surface">
                {t(settings.language, 'search')}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-m3-on-surface-variant/60" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t(settings.language, 'searchPlaceholder')}
                  className="block w-full pl-10 pr-3 py-3 bg-m3-surface-container-high border border-m3-outline/20 rounded-m3-lg text-m3-on-surface placeholder-m3-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-m3-primary/50 transition-all text-sm sm:text-base"
                />
              </div>

              {searchTerm.trim() !== '' && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => handleTransactionClick(tx, tx.date)}
                        className="p-3 flex justify-between items-center bg-m3-surface hover:bg-m3-on-surface/5 cursor-pointer rounded-m3-lg transition-colors border border-m3-outline/5"
                      >
                        <div className="flex flex-col">
                        <span className="text-sm font-semibold text-m3-on-surface">{tx.description}</span>
                        <span className="text-[10px] text-m3-on-surface-variant font-medium mt-0.5">
                          {format(new Date(tx.date), 'dd/MM/yyyy', { locale: settings.language === 'en' ? enUS : fr })}
                          {tx.recurrence !== 'NONE' && ` • ${t(settings.language, tx.recurrence.toLowerCase() as any)}`}
                        </span>
                      </div>
                        <span className={cn(
                          "text-sm font-bold",
                          tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount, settings.currency, settings.language)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-m3-on-surface-variant/60 text-sm italic font-medium">
                      {t(settings.language, 'noResults')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="mt-6 sm:mt-12 text-center text-m3-on-surface-variant/60 text-[10px] sm:text-sm font-medium pb-4 sm:pb-8">
          <p>{t(settings.language, 'footer')}</p>
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
      />
    </div>
  );
}

export default App;
