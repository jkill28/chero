import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string, language: string, noSymbol = false) {
  if (noSymbol) {
    return amount.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });
  }

  if (currency === 'AUD') {
    return `$ ${amount.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    })}`;
  }
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
