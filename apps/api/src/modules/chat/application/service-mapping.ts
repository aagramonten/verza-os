import type { PropertyType, ServiceType } from '@prisma/client';
import type { AiServiceType } from '../../ai/application/ai-turn.schema.js';

/**
 * The AI extraction taxonomy is finer-grained than the Day 1 database enums.
 * We keep the granular AI value in the collected store (for fidelity and the
 * customer summary) and map to the coarser DB enum for the typed lead column,
 * so pricing (Day 7) and the console can rely on the stable DB vocabulary
 * without a migration to Day 1's enums.
 */
export function aiServiceToDb(service: AiServiceType): ServiceType {
  switch (service) {
    case 'LANDSCAPE_DESIGN_INSTALLATION':
    case 'GARDEN_RENOVATION':
    case 'DECORATIVE_ROCK_MULCH':
      return 'DESIGN_INSTALLATION';
    case 'LAWN_INSTALLATION':
      return 'LAWN';
    case 'IRRIGATION':
      return 'IRRIGATION';
    case 'LANDSCAPE_LIGHTING':
      return 'LIGHTING';
    case 'PLANTING':
      return 'PLANTING';
    case 'CLEANUP_REMOVAL':
      return 'CLEANUP';
    case 'MAINTENANCE':
      return 'MAINTENANCE';
    case 'OTHER':
      return 'OTHER';
  }
}

export function aiPropertyToDb(
  property: 'RESIDENTIAL' | 'COMMERCIAL' | 'HOA' | 'OTHER',
): PropertyType {
  switch (property) {
    case 'RESIDENTIAL':
      return 'RESIDENTIAL';
    case 'COMMERCIAL':
      return 'COMMERCIAL';
    case 'HOA':
    case 'OTHER':
      return 'OTHER';
  }
}

const SERVICE_LABELS_ES: Record<AiServiceType, string> = {
  LANDSCAPE_DESIGN_INSTALLATION: 'diseño e instalación de jardín',
  GARDEN_RENOVATION: 'remodelación de jardín',
  LAWN_INSTALLATION: 'instalación de grama',
  IRRIGATION: 'sistema de riego',
  LANDSCAPE_LIGHTING: 'iluminación de jardín',
  PLANTING: 'siembra de plantas',
  CLEANUP_REMOVAL: 'limpieza y remoción',
  MAINTENANCE: 'mantenimiento',
  DECORATIVE_ROCK_MULCH: 'piedra decorativa y mulch',
  OTHER: 'otro trabajo de paisajismo',
};

export function serviceLabelEs(service: AiServiceType): string {
  return SERVICE_LABELS_ES[service];
}

export function isAiServiceType(value: string): value is AiServiceType {
  return value in SERVICE_LABELS_ES;
}
