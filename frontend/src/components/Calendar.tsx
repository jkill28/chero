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
  const goToToday = () => {
    const today = new Date();
    onDateChange(today);
    onDayClick(today);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
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
      className="w-full bg-m3-surface-container rounded-3xl border border-m3-card-border shadow-sm overflow-hidden transition-all"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Refined Modern Calendar Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 bg-m3-surface-container border-b border-m3-card-border flex items-center justify-between">
        {/* Month Navigation Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-m3-surface-container-high rounded-xl border border-m3-card-border p-1">
            <button
              onClick={prevMonth}
              className="p-1 sm:p-1.5 hover:bg-m3-on-surface/10 text-m3-on-surface-variant hover:text-m3-on-surface rounded-lg transition-colors"
              title={t(language, 'prevMonth')}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-m3-on-surface capitalize tracking-wide select-none">
              {format(currentDate, 'MMMM yyyy', { locale })}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 sm:p-1.5 hover:bg-m3-on-surface/10 text-m3-on-surface-variant hover:text-m3-on-surface rounded-lg transition-colors"
              title={t(language, 'nextMonth')}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-m3-surface-container-high hover:bg-m3-on-surface/10 text-m3-on-surface border border-m3-card-border transition-colors"
          >
            {t(language, 'today') || 'Today'}
          </button>
        </div>

        <div className="hidden sm:block text-xs font-medium text-m3-on-surface-variant">
          {format(selectedDate, 'EEEE do MMMM', { locale })}
        </div>
      </div>

      {/* Week days labels */}
      <div className="grid grid-cols-7 px-1.5 sm:px-3 pt-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-[11px] sm:text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant/70"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 px-1.5 sm:px-3 pb-3">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const balance = balances[dateKey];
          const transactions = dailyTransactions[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);

          const dailyNet = transactions
            .filter((t) => !t.transaction.isAdjustment)
            .reduce((sum, t) => sum + t.transaction.amount, 0);

          return (
            <div
              key={day.toString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[75px] sm:min-h-[125px] flex flex-col justify-between p-1.5 sm:p-2 relative cursor-pointer rounded-xl transition-all group border",
                isSelected
                  ? "ring-2 ring-m3-primary border-m3-primary bg-m3-primary/5 shadow-sm"
                  : "border-m3-card-border hover:border-m3-primary/50 hover:bg-m3-on-surface/5 bg-m3-surface-container",
                !isCurrentMonth && "opacity-35"
              )}
            >
              {/* Top of cell: Day number & Day balance */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {isToday ? (
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-m3-primary text-m3-on-primary flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs">
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span className={cn(
                        "text-xs sm:text-sm font-semibold transition-colors",
                        isSelected ? "text-m3-primary font-bold" : "text-m3-on-surface"
                      )}>
                        {format(day, 'd')}
                      </span>
                    )}
                  </div>

                  {balance !== undefined && (
                    <span className={cn(
                      "text-[10px] sm:text-xs font-black truncate ml-1",
                      balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {formatCurrency(balance, currency, language, true)}
                    </span>
                  )}
                </div>

                {/* Daily net variation */}
                {transactions.length > 0 && (
                  <div className={cn(
                    "text-[9px] sm:text-[11px] font-bold truncate mt-0.5",
                    dailyNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {dailyNet > 0 ? '+' : ''}{formatCurrency(dailyNet, currency, language, true)}
                  </div>
                )}
              </div>

              {/* Transactions chips (desktop only) */}
              <div className="hidden sm:flex flex-col gap-1 w-full mt-1.5 overflow-hidden">
                {transactions.slice(0, 3).map((occ, idx) => (
                  <div
                    key={`${occ.transaction.id}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(occ.transaction, occ.date);
                    }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md truncate transition-all hover:brightness-95 flex justify-between items-center shadow-2xs",
                      occ.transaction.isAdjustment
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-l-2 border-amber-500"
                        : occ.transaction.amount >= 0
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-l-2 border-rose-500"
                    )}
                    title={`${occ.transaction.description}: ${occ.transaction.amount}`}
                  >
                    <span className="truncate flex-1 mr-1 font-medium">{occ.transaction.description}</span>
                    <span className="font-bold whitespace-nowrap">
                      {formatCurrency(occ.transaction.amount, currency, language, true)}
                    </span>
                  </div>
                ))}
                {transactions.length > 3 && (
                  <div className="text-[9px] font-semibold text-m3-on-surface-variant text-right pr-1">
                    {t(language, 'moreTransactions').replace('{n}', (transactions.length - 3).toString())}
                  </div>
                )}
              </div>

              {/* Transaction indicator dots (mobile only) */}
              <div className="flex sm:hidden flex-wrap justify-center gap-1 mt-1 max-w-full">
                {transactions.slice(0, 4).map((occ, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-1 h-1 rounded-full",
                      occ.transaction.isAdjustment
                        ? "bg-amber-400"
                        : occ.transaction.amount >= 0
                          ? "bg-emerald-400"
                          : "bg-rose-400"
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
