import React from 'react';
import type { Settings, ThemeMode } from '../types';
import { X } from 'lucide-react';
import { t } from '../lib/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onSave: (e: React.FormEvent) => void;
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onSave,
  themeMode = 'system',
  onThemeModeChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-m3-surface-container rounded-3xl border border-m3-card-border w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center px-6 py-5 border-b border-m3-card-border">
          <h2 className="text-xl font-bold text-m3-on-surface">{t(settings.language, 'settings')}</h2>
          <button onClick={onClose} className="p-2 text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-on-surface/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="p-6 space-y-5">
          <div className="space-y-3.5">
            <div>
              <label htmlFor="language" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(settings.language, 'language')}</label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
              >
                <option value="fr">{t(settings.language, 'french')}</option>
                <option value="en">{t(settings.language, 'english')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="currency" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(settings.language, 'currency')}</label>
              <select
                id="currency"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
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
              <label htmlFor="theme" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(settings.language, 'theme')}</label>
              <select
                id="theme"
                value={themeMode}
                onChange={(e) => onThemeModeChange?.(e.target.value as ThemeMode)}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
              >
                <option value="system">{t(settings.language, 'system')}</option>
                <option value="dark">{t(settings.language, 'dark')}</option>
                <option value="white">{t(settings.language, 'white')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="initialBalance" className="block text-xs font-bold text-m3-on-surface-variant mb-1 uppercase tracking-wider">{t(settings.language, 'initialBalance')}</label>
              <input
                id="initialBalance"
                type="number"
                step="0.01"
                value={settings.initialBalance}
                onChange={(e) => setSettings({ ...settings, initialBalance: parseFloat(e.target.value) || 0 })}
                className="block w-full rounded-xl border border-m3-card-border focus:border-m3-primary focus:ring-1 focus:ring-m3-primary bg-m3-surface text-m3-on-surface px-4 py-2.5 text-sm font-medium transition-all outline-hidden"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-m3-card-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-m3-on-surface-variant hover:text-m3-on-surface font-semibold hover:bg-m3-on-surface/5 rounded-xl transition-colors"
            >
              {t(settings.language, 'cancel')}
            </button>
            <button
              type="submit"
              className="bg-m3-primary text-m3-on-primary px-6 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 transition-all"
            >
              {t(settings.language, 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
