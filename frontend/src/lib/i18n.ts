export const translations = {
  fr: {
    title: 'Chéro',
    subtitle: 'Calendrier budgétaire',
    addTransaction: 'Ajouter une transaction',
    settings: 'Paramètres',
    footer: 'Chaque jour affiche le solde prévisionnel basé sur vos transactions.',
    editTransaction: 'Modifier la transaction',
    newTransaction: 'Ajouter une transaction',
    credit: 'Crédit (Revenu)',
    debit: 'Débit (Dépense)',
    amount: 'Montant',
    description: 'Description',
    date: 'Date',
    recurrence: 'Récurrence',
    none: 'Aucune',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuelle',
    everyXWeeks: 'Toutes les {n} semaines',
    everyXMonths: 'Tous les {n} mois',
    endDate: 'Date de fin (Optionnel)',
    delete: 'Supprimer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    editMode: 'Type de modification',
    onlyThis: 'Uniquement cette occurrence',
    thisAndFollowing: 'Cette occurrence et les suivantes',
    deleteThis: 'Supprimer cette occurrence',
    deleteFromHere: 'Supprimer à partir d\'ici',
    deleteAll: 'Supprimer toute la série',
    currency: 'Devise',
    initialBalance: 'Solde initial',
    language: 'Langue',
    french: 'Français',
    english: 'English',
    weekDays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    intervalLabel: {
      WEEKLY: 'semaines',
      MONTHLY: 'mois'
    }
  },
  en: {
    title: 'Chéro',
    subtitle: 'Budget Calendar',
    addTransaction: 'Add Transaction',
    settings: 'Settings',
    footer: 'Each day shows the projected balance based on your transactions.',
    editTransaction: 'Edit Transaction',
    newTransaction: 'Add Transaction',
    credit: 'Credit (Income)',
    debit: 'Debit (Expense)',
    amount: 'Amount',
    description: 'Description',
    date: 'Date',
    recurrence: 'Recurrence',
    none: 'None',
    weekly: 'Weekly',
    monthly: 'Monthly',
    everyXWeeks: 'Every {n} weeks',
    everyXMonths: 'Every {n} months',
    endDate: 'End Date (Optional)',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    editMode: 'Edit Mode',
    onlyThis: 'Only this occurrence',
    thisAndFollowing: 'This and following occurrences',
    deleteThis: 'Delete this occurrence',
    deleteFromHere: 'Delete from here',
    deleteAll: 'Delete all series',
    currency: 'Currency',
    initialBalance: 'Initial Balance',
    language: 'Language',
    french: 'Français',
    english: 'English',
    weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    intervalLabel: {
      WEEKLY: 'weeks',
      MONTHLY: 'months'
    }
  }
};

export type Language = 'fr' | 'en';

export const t = (lang: string, key: keyof typeof translations.fr): any => {
  const l = (lang === 'en' ? 'en' : 'fr') as Language;
  return translations[l][key] || translations.fr[key];
};
