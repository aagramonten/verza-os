export const QUICK_ACTION_EVENTS = [
  'USER_DOES_NOT_KNOW_MEASUREMENTS',
  'USER_REQUESTS_SITE_VISIT',
  'USER_UPLOADS_PHOTOS',
  'USER_HAS_BUDGET',
  'USER_WANTS_LOW_MAINTENANCE',
  'USER_WANTS_LUXURY',
] as const;

export type QuickActionEvent = (typeof QUICK_ACTION_EVENTS)[number];

export const QUICK_ACTION_MESSAGES: Readonly<Record<QuickActionEvent, string>> = {
  USER_DOES_NOT_KNOW_MEASUREMENTS:
    'No tengo las medidas exactas. Prefiero que me orienten con alternativas o que las verifiquen en la visita.',
  USER_REQUESTS_SITE_VISIT: 'Me gustaría coordinar una visita al lugar.',
  USER_UPLOADS_PHOTOS: 'Acabo de subir fotos del área para que puedan orientarme mejor.',
  USER_HAS_BUDGET: 'Tengo un presupuesto en mente y quiero saber qué alcance puede funcionar.',
  USER_WANTS_LOW_MAINTENANCE: 'Quiero un jardín de bajo mantenimiento.',
  USER_WANTS_LUXURY: 'Me interesa un jardín más premium y elegante.',
};

export function quickActionFieldHints(event: QuickActionEvent): Record<string, unknown> {
  switch (event) {
    case 'USER_DOES_NOT_KNOW_MEASUREMENTS':
      return { measurementUnknown: true };
    case 'USER_REQUESTS_SITE_VISIT':
      return { visitRequested: true };
    case 'USER_UPLOADS_PHOTOS':
      return { photosProvided: true };
    case 'USER_HAS_BUDGET':
      return { hasBudgetSignal: true };
    case 'USER_WANTS_LOW_MAINTENANCE':
      return { lowMaintenancePreferred: true };
    case 'USER_WANTS_LUXURY':
      return { stylePreferences: ['luxury', 'premium'] };
  }
}
