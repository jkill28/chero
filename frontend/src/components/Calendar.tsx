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
      className="w-full bg-m3-surface-container rounded-m3-xl shadow-lg overflow-hidden transition-colors"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* M3 Expressive Header */}
      <div className="px-4 py-3 sm:px-6 sm:pt-6 sm:pb-4 bg-m3-surface-container border-b border-m3-outline/10">
        <div className="hidden sm:block text-m3-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">
          {t(language, 'selectDate') || 'Select date'}
        </div>
        <div className="hidden sm:flex text-m3-on-surface text-3xl font-semibold mb-6 justify-between items-end">
          <span>{format(selectedDate, 'EEE, MMM d', { locale })}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-m3-on-surface text-sm sm:text-base font-semibold capitalize">
            {format(currentDate, 'MMMM yyyy', { locale })}
          </div>
          <div className="flex space-x-0.5 sm:space-x-1">
            <button
              onClick={prevMonth}
              className="p-1.5 sm:p-2 hover:bg-m3-on-surface-variant/10 text-m3-on-surface-variant rounded-full transition-colors"
            >
              <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 sm:p-2 hover:bg-m3-on-surface-variant/10 text-m3-on-surface-variant rounded-full transition-colors"
            >
              <ChevronRight size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Week days labels */}
      <div className="grid grid-cols-7 px-1 sm:px-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="h-8 sm:h-12 flex items-center justify-center text-[10px] sm:text-sm font-medium text-m3-on-surface-variant"
          >
            {day[0]}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 px-1 sm:px-2 pb-2 sm:pb-4">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const balance = balances[dateKey];
          const transactions = dailyTransactions[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);

          const dailyNet = transactions
            .filter(t => !t.transaction.isAdjustment)
            .reduce((sum, t) => sum + t.transaction.amount, 0);

          return (
            <div
              key={day.toString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[70px] sm:min-h-[160px] flex flex-col items-center pt-1 sm:pt-2 pb-1 relative cursor-pointer rounded-lg sm:rounded-xl transition-colors group",
                !isCurrentMonth && "opacity-40",
                "hover:bg-m3-on-surface/5",
                isSelected && "bg-m3-primary/5"
              )}
            >
              {/* Date circle */}
              <div className={cn(
                "w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-sm sm:text-lg font-bold transition-all",
                isSelected
                  ? "bg-m3-primary text-m3-on-primary shadow-md scale-105 sm:scale-110"
                  : isToday
                    ? "border sm:border-2 border-m3-primary text-m3-primary"
                    : "text-m3-on-surface group-hover:bg-m3-on-surface/10"
              )}>
                {format(day, 'd')}
              </div>

              {/* Balances below the date */}
              <div className="mt-1 flex flex-col items-center gap-0 px-1 w-full overflow-hidden">
                {balance !== undefined && (
                  <div className={cn(
                    "text-[10px] sm:text-[13px] font-black truncate",
                    balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatCurrency(balance, currency, language, true)}
                  </div>
                )}
                {transactions.length > 0 && (
                  <div className={cn(
                    "text-[9px] sm:text-[11px] font-bold truncate",
                    dailyNet >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {dailyNet > 0 ? '+' : ''}{formatCurrency(dailyNet, currency, language, true)}
                  </div>
                )}
              </div>

              {/* Transaction list (desktop only) */}
              <div className="hidden sm:flex flex-col gap-1 w-full mt-2 px-1 pb-1 overflow-hidden">
                {transactions.map((occ, idx) => (
                  <div
                    key={`${occ.transaction.id}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(occ.transaction, occ.date);
                    }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-m3-xs truncate transition-all hover:brightness-95 flex justify-between items-center",
                      occ.transaction.isAdjustment
                        ? "bg-amber-100 text-amber-900 border-l-2 border-amber-500 dark:bg-amber-900/30 dark:text-amber-200"
                        : occ.transaction.amount >= 0
                          ? "bg-emerald-100 text-emerald-900 border-l-2 border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-900 border-l-2 border-rose-500 dark:bg-rose-900/30 dark:text-rose-200"
                    )}
                    title={`${occ.transaction.description}: ${occ.transaction.amount}`}
                  >
                    <span className="truncate flex-1 mr-1 font-medium">{occ.transaction.description}</span>
                    <span className="font-bold whitespace-nowrap">
                      {formatCurrency(occ.transaction.amount, currency, language, true)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Indicators for mobile if many transactions */}
              <div className="flex sm:hidden flex-wrap justify-center gap-0.5 mt-0.5 max-w-full px-0.5">
                {transactions.slice(0, 3).map((occ, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-0.5 h-0.5 rounded-full",
                      occ.transaction.amount >= 0 ? "bg-emerald-400" : "bg-rose-400"
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
