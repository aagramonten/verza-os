import { hasMeasurements, hasValue, type CollectedProjectState } from './collected-project.js';
import { isAiServiceType, serviceLabelEs } from './service-mapping.js';

export interface SummaryLine {
  label: string;
  value: string;
}

export interface ConfirmationSummary {
  lines: SummaryLine[];
  photoCount: number;
}

const AREA_LABELS: Record<string, string> = {
  FRONT_YARD: 'jardín frontal',
  BACK_YARD: 'patio',
  SIDE_YARD: 'jardín lateral',
  ENTRANCE: 'entrada',
  MULTIPLE: 'varias áreas',
  OTHER: 'otra área',
};

/**
 * Builds the confirmation summary strictly from persisted, validated data —
 * never from raw AI output. Only the customer-facing labels appear; internal
 * field names, scores, and ids never do.
 */
export function buildSummary(
  collected: CollectedProjectState,
  photoCount: number,
): ConfirmationSummary {
  const lines: SummaryLine[] = [];
  const push = (label: string, field: string, format?: (v: unknown) => string): void => {
    if (hasValue(collected, field)) {
      const raw = collected.fields[field];
      lines.push({ label, value: format ? format(raw) : String(raw) });
    }
  };

  push('Nombre', 'customerName');
  push('Teléfono', 'phone');
  push('Pueblo', 'municipality');
  push('Servicio', 'serviceType', (v) =>
    typeof v === 'string' && isAiServiceType(v) ? serviceLabelEs(v) : String(v),
  );
  push('Área', 'projectArea', (v) => AREA_LABELS[String(v)] ?? String(v));
  push('Descripción', 'description');

  if (hasMeasurements(collected)) {
    lines.push({ label: 'Medidas', value: formatMeasurements(collected) });
  } else {
    lines.push({ label: 'Medidas', value: 'pendientes (se verifican en la visita)' });
  }

  push('Remoción necesaria', 'requiresRemoval', boolEs);
  push('Riego existente', 'hasIrrigation', boolEs);
  push('Estilo', 'stylePreferences', (v) => (Array.isArray(v) ? v.join(', ') : String(v)));
  if (hasBudget(collected)) {
    lines.push({ label: 'Presupuesto aproximado', value: formatBudget(collected) });
  }

  lines.push({ label: 'Fotos recibidas', value: String(photoCount) });
  return { lines, photoCount };
}

function boolEs(value: unknown): string {
  return value === true ? 'sí' : 'no';
}

function formatMeasurements(collected: CollectedProjectState): string {
  const sqft = collected.fields['computedSquareFeet'] ?? collected.fields['reportedSquareFeet'];
  const length = collected.fields['lengthFt'];
  const width = collected.fields['widthFt'];
  if (typeof length === 'number' && typeof width === 'number') {
    const area = collected.fields['computedSquareFeet'];
    return `${length} ft x ${width} ft${typeof area === 'number' ? ` (~${area} sq ft)` : ''}`;
  }
  return typeof sqft === 'number' ? `~${sqft} sq ft` : 'pendientes';
}

function hasBudget(collected: CollectedProjectState): boolean {
  return hasValue(collected, 'budgetMinCents') || hasValue(collected, 'budgetMaxCents');
}

function formatBudget(collected: CollectedProjectState): string {
  const min = collected.fields['budgetMinCents'];
  const max = collected.fields['budgetMaxCents'];
  const toUsd = (cents: unknown): string =>
    typeof cents === 'number' ? `$${Math.round(cents / 100).toLocaleString('en-US')}` : '';
  if (typeof min === 'number' && typeof max === 'number') return `${toUsd(min)} – ${toUsd(max)}`;
  return toUsd(min ?? max);
}
