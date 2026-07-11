import type { AiServiceType } from './ai-turn.schema.js';

/**
 * Approved knowledge Vera is allowed to use. She may NOT invent anything
 * outside this set (years in business, customer counts, reviews,
 * certifications, guarantees, prices, availability, inventory). When a detail
 * is not covered here, Vera says the Verza Garden team will review it.
 */
export const TRUST_FACTS: readonly string[] = [
  'Verza Garden ofrece diseño, instalación y mantenimiento de jardines en Puerto Rico.',
  'Un especialista de Verza Garden revisa cada estimado antes de enviarlo; ningún precio es oficial hasta esa revisión.',
  'La visita al lugar es sin costo y sirve para tomar medidas y confirmar las condiciones del área.',
  'Verza Garden se especializa en jardines tropicales de bajo mantenimiento.',
];

export const SERVICE_DESCRIPTIONS: Readonly<Record<AiServiceType, string>> = {
  LANDSCAPE_DESIGN_INSTALLATION: 'Diseño e instalación de jardines a la medida.',
  GARDEN_RENOVATION: 'Remodelación y renovación de jardines existentes.',
  LAWN_INSTALLATION: 'Instalación de grama natural o sintética.',
  IRRIGATION: 'Sistemas de riego nuevos, reparación o expansión.',
  LANDSCAPE_LIGHTING: 'Iluminación exterior para jardines y fachadas.',
  PLANTING: 'Siembra de plantas, arbustos y árboles.',
  CLEANUP_REMOVAL: 'Limpieza de terreno y remoción de plantas o escombros.',
  MAINTENANCE: 'Mantenimiento recurrente de jardines.',
  DECORATIVE_ROCK_MULCH: 'Instalación de piedra decorativa y mulch.',
  OTHER: 'Otros trabajos de paisajismo.',
};

/**
 * Server-authorized question priorities per service (strategy §7). The
 * orchestrator selects the next unmet priority for the active service and
 * passes it to the prompt as the topic to pursue this turn — the model does
 * not choose the agenda.
 */
export const SERVICE_PRIORITIES: Readonly<Record<AiServiceType, readonly string[]>> = {
  LANDSCAPE_DESIGN_INSTALLATION: [
    'municipality',
    'projectArea',
    'photos',
    'stylePreferences',
    'lowMaintenancePreferred',
    'requiresRemoval',
    'budgetOrTimeline',
    'siteVisit',
  ],
  GARDEN_RENOVATION: [
    'municipality',
    'projectArea',
    'photos',
    'stylePreferences',
    'lowMaintenancePreferred',
    'requiresRemoval',
    'budgetOrTimeline',
    'siteVisit',
  ],
  LAWN_INSTALLATION: [
    'municipality',
    'requiresRemoval',
    'measurements',
    'photos',
    'hasIrrigation',
    'desiredDate',
    'siteVisit',
  ],
  IRRIGATION: [
    'municipality',
    'hasIrrigation',
    'projectArea',
    'photos',
    'description',
    'siteVisit',
  ],
  LANDSCAPE_LIGHTING: ['municipality', 'projectArea', 'photos', 'stylePreferences', 'siteVisit'],
  PLANTING: ['municipality', 'projectArea', 'plantPreferences', 'photos', 'siteVisit'],
  CLEANUP_REMOVAL: [
    'municipality',
    'photos',
    'description',
    'requiresRemoval',
    'desiredDate',
    'siteVisit',
  ],
  MAINTENANCE: [
    'municipality',
    'propertyType',
    'photos',
    'description',
    'desiredDate',
    'siteVisit',
  ],
  DECORATIVE_ROCK_MULCH: ['municipality', 'projectArea', 'measurements', 'photos', 'siteVisit'],
  OTHER: ['municipality', 'description', 'photos', 'siteVisit'],
};

export const PRELIMINARY_PRICE_DISCLAIMER =
  'Cualquier número que mencione es solo una referencia preliminar; el estimado oficial lo prepara ' +
  'y aprueba el equipo de Verza Garden luego de revisar las fotos, medidas y condiciones del área.';
