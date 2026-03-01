import React from 'react';
import type { Settings } from '../types';
import { t } from '../lib/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onSave: (e: React.FormEvent) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-m3-on-surface/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-m3-surface-container rounded-m3-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-6 border-b border-m3-outline/10">
          <h2 className="text-2xl font-bold text-m3-on-surface">{t(settings.language, 'settings')}</h2>
        </div>
        <form onSubmit={onSave} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="language" className="block text-sm font-bold text-m3-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider">{t(settings.language, 'language')}</label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="block w-full rounded-m3-lg border-2 border-m3-outline/20 focus:border-m3-primary focus:ring-0 bg-m3-surface text-m3-on-surface p-4 font-medium transition-all"
              >
                <option value="fr">{t(settings.language, 'french')}</option>
                <option value="en">{t(settings.language, 'english')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-bold text-m3-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider">{t(settings.language, 'currency')}</label>
              <select
                id="currency"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="block w-full rounded-m3-lg border-2 border-m3-outline/20 focus:border-m3-primary focus:ring-0 bg-m3-surface text-m3-on-surface p-4 font-medium transition-all"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
            <div>
              <label htmlFor="initialBalance" className="block text-sm font-bold text-m3-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider">{t(settings.language, 'initialBalance')}</label>
              <input
                id="initialBalance"
                type="number"
                step="0.01"
                value={settings.initialBalance}
                onChange={(e) => setSettings({ ...settings, initialBalance: parseFloat(e.target.value) })}
                className="block w-full rounded-m3-lg border-2 border-m3-outline/20 focus:border-m3-primary focus:ring-0 bg-m3-surface text-m3-on-surface p-4 font-medium transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 text-m3-primary font-bold hover:bg-m3-primary/5 rounded-full transition-colors"
            >
              {t(settings.language, 'cancel')}
            </button>
            <button
              type="submit"
              className="bg-m3-primary text-m3-on-primary px-8 py-3.5 rounded-full font-bold shadow-md hover:shadow-lg transition-all"
            >
              {t(settings.language, 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
