import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Recurrence } from '../types';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { t } from '../lib/i18n';
import { cn } from '../lib/utils';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Partial<Transaction>) => void;
  onDelete?: (id: number) => void;
  onDeleteComplex?: (id: number, mode: 'single' | 'future' | 'all') => void;
  transaction?: Transaction | null;
  selectedDate?: Date;
  onSaveComplex?: (transaction: Partial<Transaction>, mode: 'single' | 'future') => void;
  language: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDeleteComplex,
  transaction,
  selectedDate,
  onSaveComplex,
  language
}) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit' | 'adjustment'>('credit');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [editMode, setEditMode] = useState<'single' | 'future'>('future');

  const initialValues = useMemo(() => {
    if (transaction) {
      return {
        amount: Math.abs(transaction.amount).toString(),
        type: (transaction.isAdjustment ? 'adjustment' : (transaction.amount >= 0 ? 'credit' : 'debit')) as 'credit' | 'debit' | 'adjustment',
        description: transaction.description,
        date: format(selectedDate || new Date(transaction.date), 'yyyy-MM-dd'),
        recurrence: transaction.recurrence,
        recurrenceInterval: transaction.recurrenceInterval || 1,
        recurrenceEndDate: transaction.recurrenceEndDate ? format(new Date(transaction.recurrenceEndDate), 'yyyy-MM-dd') : '',
      };
    } else if (selectedDate) {
      return {
        amount: '',
        type: 'credit' as const,
        description: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        recurrence: 'NONE' as const,
        recurrenceInterval: 1,
        recurrenceEndDate: '',
      };
    }
    return null;
  }, [transaction, selectedDate]);

  useEffect(() => {
    if (isOpen && initialValues) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(initialValues.amount);
      setType(initialValues.type);
      setDescription(initialValues.description);
      setDate(initialValues.date);
      setRecurrence(initialValues.recurrence);
      setRecurrenceInterval(initialValues.recurrenceInterval);
      setRecurrenceEndDate(initialValues.recurrenceEndDate);
    }
  }, [isOpen, initialValues]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const finalAmount = type === 'credit' ? parsedAmount : (type === 'adjustment' ? parsedAmount : -parsedAmount);
    const data: Partial<Transaction> = {
      id: transaction?.id,
      amount: finalAmount,
      description,
      date: new Date(date).toISOString(),
      recurrence,
      isAdjustment: type === 'adjustment',
      recurrenceInterval,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
    };

    if (transaction && transaction.recurrence !== 'NONE' && onSaveComplex) {
      onSaveComplex(data, editMode);
    } else {
      onSave(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-m3-surface-container rounded-3xl border border-m3-card-border w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center px-6 py-5 border-b border-m3-card-border">
          <h2 className="text-xl font-bold text-m3-on-surface">
            {transaction ? t(language, 'editTransaction') : t(language, 'newTransaction')}
          </h2>
          <button onClick={onClose} className="p-2 text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-on-surface/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Segmented type switcher */}
          <div className="flex p-1 bg-m3-surface-container-high rounded-xl border border-m3-card-border gap-1">
            <button
              type="button"
              onClick={() => setType('credit')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all border",
                type === 'credit'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-xs'
                  : 'text-m3-on-surface-variant hover:text-m3-on-surface border-transparent'
              )}
            >
              {t(language, 'credit')}
            </button>
            <button
              type="button"
              onClick={() => setType('debit')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all border",
                type === 'debit'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 shadow-xs'
                  : 'text-m3-on-surface-variant hover:text-m3-on-surface border-transparent'
              )}
            >
              {t(language, 'debit')}
            </button>
            <button
              type="button"
              onClick={() => setType('adjustment')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all border",
                type === 'adjustment'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-xs'
                  : 'text-m3-on-surface-variant hover:text-m3-on-surface border-transparent'
              )}
            >
              {t(language, 'adjustment')}
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label htmlFor="tx-amount" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(language, 'amount')}</label>
              <input
                id="tx-amount"
                type="number"
                name="amount"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-3 text-lg font-bold transition-all outline-hidden"
                required
              />
            </div>
            <div>
              <label htmlFor="tx-description" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(language, 'description')}</label>
              <input
                id="tx-description"
                type="text"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(language, 'descriptionPlaceholder')}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(language, 'date')}</label>
              <input
                type="date"
                name="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
                required
              />
            </div>
          </div>

          {transaction && transaction.recurrence !== 'NONE' && (
            <div className="p-3.5 bg-m3-surface-container-high rounded-xl border border-m3-card-border space-y-2">
              <label className="block text-xs font-bold text-m3-on-surface uppercase tracking-wider">{t(language, 'editMode')}</label>
              <div className="space-y-1.5">
                <label className="flex items-center text-xs font-semibold text-m3-on-surface cursor-pointer">
                  <input
                    type="radio"
                    checked={editMode === 'single'}
                    onChange={() => setEditMode('single')}
                    className="mr-2.5 w-4 h-4 text-m3-primary focus:ring-m3-primary"
                  />
                  {t(language, 'onlyThis')}
                </label>
                <label className="flex items-center text-xs font-semibold text-m3-on-surface cursor-pointer">
                  <input
                    type="radio"
                    checked={editMode === 'future'}
                    onChange={() => setEditMode('future')}
                    className="mr-2.5 w-4 h-4 text-m3-primary focus:ring-m3-primary"
                  />
                  {t(language, 'thisAndFollowing')}
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(language, 'recurrence')}</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-3 py-2.5 text-xs font-medium transition-all outline-hidden"
              >
                <option value="NONE">{t(language, 'none')}</option>
                <option value="WEEKLY">{t(language, 'weekly')}</option>
                <option value="MONTHLY">{t(language, 'monthly')}</option>
              </select>
            </div>
            {recurrence !== 'NONE' && (
              <div>
                <label className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">
                  {recurrence === 'WEEKLY' ? t(language, 'everyXWeeks').replace('{n}', '') : t(language, 'everyXMonths').replace('{n}', '')}
                </label>
                <div className="flex items-center gap-1.5">
                  {recurrence === 'WEEKLY' ? (
                    <select
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                      className="flex-1 rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-3 py-2.5 text-xs font-medium transition-all outline-hidden"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                      className="flex-1 rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-3 py-2.5 text-xs font-medium transition-all outline-hidden"
                    />
                  )}
                  <span className="text-[10px] font-bold text-m3-on-surface-variant uppercase whitespace-nowrap">
                    {t(language, 'intervalLabel')[recurrence as 'WEEKLY' | 'MONTHLY']}
                  </span>
                </div>
              </div>
            )}
          </div>

          {recurrence !== 'NONE' && (
            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(language, 'endDate')}</label>
              <input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-3 py-2.5 text-xs font-medium transition-all outline-hidden"
              />
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-m3-on-surface-variant hover:text-m3-on-surface font-semibold hover:bg-m3-on-surface/5 rounded-xl transition-colors"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="submit"
                className="bg-m3-primary text-m3-on-primary px-6 py-2.5 rounded-xl text-xs font-bold shadow-md hover:brightness-110 transition-all"
              >
                {t(language, 'save')}
              </button>
            </div>

            {transaction && (
              <div className="flex flex-col gap-1.5 pt-3 border-t border-m3-card-border">
                {transaction.recurrence !== 'NONE' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onDeleteComplex?.(transaction.id, 'single')}
                      className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 p-2 text-xs font-bold text-left rounded-lg transition-colors"
                    >
                      {t(language, 'deleteThis')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteComplex?.(transaction.id, 'future')}
                      className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 p-2 text-xs font-bold text-left rounded-lg transition-colors"
                    >
                      {t(language, 'deleteFromHere')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(transaction.id)}
                      className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 p-2 text-xs font-bold text-left rounded-lg transition-colors"
                    >
                      {t(language, 'deleteAll')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDelete?.(transaction.id)}
                    className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 p-2 text-xs font-bold text-center rounded-lg transition-colors"
                  >
                    {t(language, 'delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
