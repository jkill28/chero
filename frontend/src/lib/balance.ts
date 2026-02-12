import type { Transaction, TransactionOccurrence } from '../types';
import { addDays, addWeeks, addMonths, isBefore, isSameDay, startOfDay, format } from 'date-fns';

export function getDailyBalances(
  transactions: Transaction[],
  initialBalance: number,
  viewStartDate: Date,
  viewEndDate: Date
) {
  const dayToAmount: Record<string, number> = {};
  const dayToAdjustment: Record<string, number> = {};
  const dailyTransactions: Record<string, TransactionOccurrence[]> = {};

  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };

  transactions.forEach((tx) => {
    const txDate = toLocalDate(tx.date);
    const amount = tx.amount;
    const excluded = tx.excludedDates ? tx.excludedDates.split(',') : [];

    if (tx.recurrence === 'NONE') {
      const dateKey = format(txDate, 'yyyy-MM-dd');
      if (!excluded.includes(dateKey)) {
        if (tx.isAdjustment) {
          dayToAdjustment[dateKey] = amount;
        } else {
          dayToAmount[dateKey] = (dayToAmount[dateKey] || 0) + amount;
        }
        if (!dailyTransactions[dateKey]) dailyTransactions[dateKey] = [];
        dailyTransactions[dateKey].push({ transaction: tx, date: tx.date });
      }
    } else {
      let occurrenceDate = txDate;
      const recurrenceEnd = tx.recurrenceEndDate ? toLocalDate(tx.recurrenceEndDate) : addMonths(viewEndDate, 1);

      while (isBefore(occurrenceDate, recurrenceEnd) || isSameDay(occurrenceDate, recurrenceEnd)) {
        const dateKey = format(occurrenceDate, 'yyyy-MM-dd');
        if (!excluded.includes(dateKey)) {
          if (tx.isAdjustment) {
            dayToAdjustment[dateKey] = amount;
          } else {
            dayToAmount[dateKey] = (dayToAmount[dateKey] || 0) + amount;
          }
          if (!dailyTransactions[dateKey]) dailyTransactions[dateKey] = [];
          dailyTransactions[dateKey].push({ transaction: tx, date: occurrenceDate.toISOString() });
        }

        if (tx.recurrence === 'WEEKLY') {
          occurrenceDate = addWeeks(occurrenceDate, tx.recurrenceInterval || 1);
        } else if (tx.recurrence === 'MONTHLY') {
          occurrenceDate = addMonths(occurrenceDate, tx.recurrenceInterval || 1);
        }
      }
    }
  });

  const balances: Record<string, number> = {};
  const viewDailyTransactions: Record<string, TransactionOccurrence[]> = {};

  // To calculate balance from history, we need to start from the earliest transaction
  const allTxDates = [...Object.keys(dayToAmount), ...Object.keys(dayToAdjustment)];
  const minDate = allTxDates.length > 0
    ? startOfDay(new Date([...allTxDates].sort()[0]))
    : startOfDay(viewStartDate);

  const startCalculationDate = isBefore(minDate, viewStartDate) ? minDate : startOfDay(viewStartDate);

  let d = startCalculationDate;
  const end = startOfDay(viewEndDate);

  let balance = initialBalance;
  while(isBefore(d, end) || isSameDay(d, end)) {
    const dateKey = format(d, 'yyyy-MM-dd');
    if (dayToAdjustment[dateKey] !== undefined) {
      balance = dayToAdjustment[dateKey];
    } else {
      balance += (dayToAmount[dateKey] || 0);
    }

    if (isSameDay(d, viewStartDate) || isBefore(viewStartDate, d)) {
      balances[dateKey] = balance;
      if (dailyTransactions[dateKey]) {
        viewDailyTransactions[dateKey] = dailyTransactions[dateKey];
      }
    }

    d = addDays(d, 1);
  }

  return { balances, dailyTransactions: viewDailyTransactions };
}
