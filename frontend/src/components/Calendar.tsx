import React, { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../lib/i18n';
import { cn, formatCurrency } from '../lib/utils';
import type { Transaction, TransactionOccurrence } from '../types';

interface CalendarProps {
  currentDate: Date;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
  onTransactionClick: (tx: Transaction, occurrenceDate: string) => void;
  balances: Record<string, number>;
  dailyTransactions: Record<string, TransactionOccurrence[]>;
  currency: string;
  language: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  selectedDate,
  onDateChange,
  onDayClick,
  onTransactionClick,
  balances,
  dailyTransactions,
  currency,
  language,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => onDateChange(addMonths(currentDate, 1));
  const prevMonth = () => onDateChange(subMonths(currentDate, 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const delta = touchStart - touchEnd;

    if (delta > 50) {
      nextMonth();
    } else if (delta < -50) {
      prevMonth();
    }
    setTouchStart(null);
  };

  const locale = language === 'en' ? enUS : fr;
  const weekDays = t(language, 'weekDays') as string[];

  return (
    <div
      className="w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold dark:text-white capitalize">
          {format(currentDate, 'MMMM yyyy', { locale })}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ChevronLeft className="dark:text-white" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ChevronRight className="dark:text-white" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const balance = balances[dateKey];
          const transactions = dailyTransactions[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);

          const dailyIncome = transactions
            .filter(t => t.transaction.amount > 0 && !t.transaction.isAdjustment)
            .reduce((sum, t) => sum + t.transaction.amount, 0);
          const dailyExpenses = transactions
            .filter(t => t.transaction.amount < 0 && !t.transaction.isAdjustment)
            .reduce((sum, t) => sum + Math.abs(t.transaction.amount), 0);

          return (
            <div
              key={day.toString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[60px] sm:min-h-[120px] flex flex-col border-r border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                !isCurrentMonth && "bg-gray-50/50 dark:bg-gray-900/30 text-gray-400 dark:text-gray-600",
                isToday && "ring-2 ring-inset ring-indigo-600 dark:ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20",
                isSelected && !isToday && "bg-indigo-50 dark:bg-indigo-900/40"
              )}
            >
              <div className={cn(
                "flex flex-col mb-1 px-1 py-1 pointer-events-none border-b border-gray-200 dark:border-gray-700",
                isToday ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-100 dark:bg-gray-700/50"
              )}>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-[10px] font-bold",
                    isToday ? "text-white" : "text-gray-500 dark:text-gray-400"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {balance !== undefined && (
                    <div className={cn(
                      "text-[10px] sm:text-[11px] font-black",
                      isToday
                        ? "text-white"
                        : (balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")
                    )}>
                      <span className="sm:hidden">{formatCurrency(balance, currency, language, true)}</span>
                      <span className="hidden sm:inline">{formatCurrency(balance, currency, language)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile view lines */}
              <div className="flex sm:hidden flex-col gap-0 px-1 pb-1 overflow-hidden">
                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                  {dailyIncome > 0 && `+${formatCurrency(dailyIncome, currency, language, true)}`}
                </div>
                <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold truncate">
                  {dailyExpenses > 0 && `-${formatCurrency(dailyExpenses, currency, language, true)}`}
                </div>
              </div>

              {/* Desktop view list */}
              <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden p-1">
                {transactions.map((occ, idx) => (
                  <div
                    key={`${occ.transaction.id}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(occ.transaction, occ.date);
                    }}
                    className={cn(
                      "text-[9.5px] px-1.5 py-0.5 rounded-sm truncate transition-opacity hover:opacity-80 flex justify-between",
                      occ.transaction.isAdjustment
                        ? "bg-amber-50 text-amber-700 border-l-2 border-amber-500 dark:bg-amber-900/20 dark:text-amber-300"
                        : occ.transaction.amount >= 0
                          ? "bg-emerald-50 text-emerald-700 border-l-2 border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 border-l-2 border-rose-500 dark:bg-rose-900/20 dark:text-rose-300"
                    )}
                    title={`${occ.transaction.description}: ${occ.transaction.amount}`}
                  >
                    <span className="truncate flex-1 mr-1">{occ.transaction.description}</span>
                    <span className="font-bold whitespace-nowrap">
                      {formatCurrency(occ.transaction.amount, currency, language)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
