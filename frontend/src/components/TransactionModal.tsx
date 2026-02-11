import React, { useState, useEffect } from 'react';
import type { Transaction, Recurrence } from '../types';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { t } from '../lib/i18n';

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
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [editMode, setEditMode] = useState<'single' | 'future'>('future');

  useEffect(() => {
    if (transaction) {
      setAmount(Math.abs(transaction.amount).toString());
      setType(transaction.amount >= 0 ? 'credit' : 'debit');
      setDescription(transaction.description);
      setDate(format(selectedDate || new Date(transaction.date), 'yyyy-MM-dd'));
      setRecurrence(transaction.recurrence);
      setRecurrenceInterval(transaction.recurrenceInterval || 1);
      setRecurrenceEndDate(transaction.recurrenceEndDate ? format(new Date(transaction.recurrenceEndDate), 'yyyy-MM-dd') : '');
    } else if (selectedDate) {
      setAmount('');
      setType('credit');
      setDescription('');
      setDate(format(selectedDate, 'yyyy-MM-dd'));
      setRecurrence('NONE');
      setRecurrenceInterval(1);
      setRecurrenceEndDate('');
    }
  }, [transaction, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = type === 'credit' ? parseFloat(amount) : -parseFloat(amount);
    const data: Partial<Transaction> = {
      id: transaction?.id,
      amount: finalAmount,
      description,
      date: new Date(date).toISOString(),
      recurrence,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold dark:text-white">
            {transaction ? t(language, 'editTransaction') : t(language, 'newTransaction')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setType('credit')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                type === 'credit'
                  ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(language, 'credit')}
            </button>
            <button
              type="button"
              onClick={() => setType('debit')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                type === 'debit'
                  ? 'bg-white dark:bg-gray-600 shadow text-red-600 dark:text-red-400'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(language, 'debit')}
            </button>
          </div>
          <div>
            <label htmlFor="tx-amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t(language, 'amount')}</label>
            <div className="relative">
              <input
                id="tx-amount"
                type="number"
                name="amount"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white p-3 border text-lg"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="tx-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t(language, 'description')}</label>
            <input
              id="tx-description"
              type="text"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t(language, 'date')}</label>
            <input
              type="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
              required
            />
          </div>
          {transaction && transaction.recurrence !== 'NONE' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
              <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300">{t(language, 'editMode')}</label>
              <div className="space-y-1">
                <label className="flex items-center text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={editMode === 'single'}
                    onChange={() => setEditMode('single')}
                    className="mr-2"
                  />
                  {t(language, 'onlyThis')}
                </label>
                <label className="flex items-center text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={editMode === 'future'}
                    onChange={() => setEditMode('future')}
                    className="mr-2"
                  />
                  {t(language, 'thisAndFollowing')}
                </label>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t(language, 'recurrence')}</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
              >
                <option value="NONE">{t(language, 'none')}</option>
                <option value="WEEKLY">{t(language, 'weekly')}</option>
                <option value="MONTHLY">{t(language, 'monthly')}</option>
              </select>
            </div>
            {recurrence !== 'NONE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {recurrence === 'WEEKLY' ? t(language, 'everyXWeeks').replace('{n}', '') : t(language, 'everyXMonths').replace('{n}', '')}
                </label>
                {recurrence === 'WEEKLY' ? (
                  <select
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
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
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                  />
                )}
                <span className="text-xs text-gray-500 ml-1">
                  {t(language, 'intervalLabel')[recurrence as 'WEEKLY' | 'MONTHLY']}
                </span>
              </div>
            )}
          </div>
          {recurrence !== 'NONE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t(language, 'endDate')}</label>
              <input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
              />
            </div>
          )}
          <div className="flex justify-between pt-4">
            {transaction && (
              <div className="flex flex-col gap-2">
                {transaction.recurrence !== 'NONE' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onDeleteComplex?.(transaction.id, 'single')}
                      className="text-red-600 hover:text-red-700 text-sm font-medium text-left"
                    >
                      {t(language, 'deleteThis')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteComplex?.(transaction.id, 'future')}
                      className="text-red-600 hover:text-red-700 text-sm font-medium text-left"
                    >
                      {t(language, 'deleteFromHere')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(transaction.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium text-left"
                    >
                      {t(language, 'deleteAll')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDelete?.(transaction.id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                  >
                    {t(language, 'delete')}
                  </button>
                )}
              </div>
            )}
            <div className="flex space-x-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                {t(language, 'save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
