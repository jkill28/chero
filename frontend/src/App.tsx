import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Calendar } from './components/Calendar';
import { TransactionModal } from './components/TransactionModal';
import { SettingsModal } from './components/SettingsModal';
import type { Transaction, Settings } from './types';
import { getDailyBalances } from './lib/balance';
import { Settings as SettingsIcon, Plus } from 'lucide-react';
import { t } from './lib/i18n';
import { formatCurrency } from './lib/utils';

const API_BASE = '/api';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: 'AUD', initialBalance: 0, language: 'fr' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const todayBalance = useMemo(() => {
    const today = new Date();
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

  async function fetchTransactions() {
    try {
      const res = await axios.get(`${API_BASE}/transactions`);
      setTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    }
  }

  async function fetchSettings() {
    try {
      const res = await axios.get(`${API_BASE}/settings`);
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
  }

  useEffect(() => {
    fetchTransactions();
    fetchSettings();
  }, []);

  const { balances, dailyTransactions } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return getDailyBalances(transactions, settings.initialBalance, startDate, endDate);
  }, [transactions, settings, currentDate]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTransaction(null);
    setIsModalOpen(true);
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t(settings.language, 'title')}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {formattedDate} ({formatCurrency(todayBalance, settings.currency, settings.language)})
            </p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setSelectedTransaction(null);
                setSelectedDate(new Date());
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center text-sm sm:text-base"
            >
              <Plus size={20} className="mr-2" /> {t(settings.language, 'addTransaction')}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Paramètres"
              className="p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <SettingsIcon size={24} />
            </button>
          </div>
        </header>

        <main>
          <Calendar
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onDayClick={handleDayClick}
            onTransactionClick={handleTransactionClick}
            balances={balances}
            dailyTransactions={dailyTransactions}
            currency={settings.currency}
            language={settings.language}
          />
        </main>

        <footer className="mt-8 text-center text-gray-500 text-sm">
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
