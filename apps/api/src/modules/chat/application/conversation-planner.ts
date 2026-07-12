import type { AiServiceType } from '../../ai/application/ai-turn.schema.js';
import { SERVICE_CONVERSATION_FLOWS, SERVICE_PRIORITIES } from '../../ai/application/knowledge.js';
import { hasMeasurements, hasValue, type CollectedProjectState } from './collected-project.js';

export interface ConversationPlan {
  priorityTopic: string | null;
  missingInformation: string[];
  optionalInformation: string[];
  canWaitUntilVisit: string[];
  inferredSignals: string[];
  ownerSummary: Record<string, string>;
  privateOwnerReport: {
    leadQuality: string;
    buyingIntent: string;
    conversationConfidence: string;
    estimatedProjectSize: string;
    estimatedLabor: string;
    estimatedMaterials: string;
    estimatedDifficulty: string;
    estimatedDuration: string;
    recommendedServices: string[];
    crossSellOpportunities: string[];
    possibleRisks: string[];
    suggestedPricingStrategy: string;
    suggestedVisitPriority: string;
    recommendedFollowUp: string;
    missingInformation: string[];
  };
}

export function planConversation(input: {
  collected: CollectedProjectState;
  service: AiServiceType | null;
  photoCount: number;
  latestCustomerMessage: string;
}): ConversationPlan {
  const priorityTopic = nextPriority(input.collected, input.service, input.photoCount);
  const flow = input.service === null ? null : SERVICE_CONVERSATION_FLOWS[input.service];
  const missingInformation = computeMissing(input.collected, input.photoCount, flow?.requiredInformation ?? []);
  const optionalInformation = computeMissing(input.collected, input.photoCount, flow?.optionalInformation ?? []);
  const inferredSignals = inferSignals(input.collected, input.latestCustomerMessage);
  const ownerSummary = buildOwnerSummary(input.collected, input.photoCount, inferredSignals);
  const projectSize = estimateProjectSize(input.collected);
  const crossSellOpportunities = flow?.crossSellOpportunities.slice(0, 4) ?? [];

  return {
    priorityTopic,
    missingInformation,
    optionalInformation,
    canWaitUntilVisit: waitUntilVisit(missingInformation, optionalInformation),
    inferredSignals,
    ownerSummary,
    privateOwnerReport: {
      leadQuality: leadQuality(input.collected, input.photoCount, inferredSignals),
      buyingIntent: buyingIntent(inferredSignals),
      conversationConfidence: confidenceLabel(input.collected, input.photoCount),
      estimatedProjectSize: projectSize,
      estimatedLabor: projectSize === 'large' ? 'high' : projectSize === 'medium' ? 'medium' : 'unknown',
      estimatedMaterials: materialLabel(input.service),
      estimatedDifficulty: difficultyLabel(input.collected, input.service),
      estimatedDuration: durationLabel(input.service, projectSize),
      recommendedServices: recommendedServices(input.service),
      crossSellOpportunities,
      possibleRisks: possibleRisks(input.collected, inferredSignals),
      suggestedPricingStrategy:
        'Use deterministic pricing rules only; treat any AI guidance as scope context for human review.',
      suggestedVisitPriority: visitPriority(inferredSignals, input.photoCount),
      recommendedFollowUp: inferredSignals.includes('requests_visit')
        ? 'Call within 2 hours with concrete visit windows.'
        : 'Continue collecting scope, then offer the free site visit.',
      missingInformation,
    },
  };
}

function nextPriority(
  collected: CollectedProjectState,
  service: AiServiceType | null,
  photoCount: number,
): string | null {
  if (service === null) return 'serviceType';
  const met = topicMap(collected, photoCount);
  const serviceFlow = SERVICE_CONVERSATION_FLOWS[service];
  const priorities = serviceFlow.questionPriority.length > 0 ? serviceFlow.questionPriority : SERVICE_PRIORITIES[service];
  for (const topic of priorities) {
    if (met[topic] === false) return topic;
  }
  return 'siteVisit';
}

function topicMap(collected: CollectedProjectState, photoCount: number): Record<string, boolean> {
  return {
    serviceType: hasValue(collected, 'serviceType'),
    vision: hasValue(collected, 'description'),
    currentCondition: hasValue(collected, 'description'),
    desiredChange: hasValue(collected, 'description'),
    description: hasValue(collected, 'description'),
    scope: hasValue(collected, 'description'),
    municipality: hasValue(collected, 'municipality'),
    propertyType: hasValue(collected, 'propertyType'),
    projectArea: hasValue(collected, 'projectArea'),
    photos: photoCount > 0,
    measurements: hasMeasurements(collected),
    area: hasMeasurements(collected),
    stylePreferences: hasValue(collected, 'stylePreferences'),
    plantPreferences: hasValue(collected, 'plantPreferences'),
    maintenancePreference: hasValue(collected, 'lowMaintenancePreferred'),
    lowMaintenancePreferred: hasValue(collected, 'lowMaintenancePreferred'),
    requiresRemoval: hasValue(collected, 'requiresRemoval'),
    removalNeeded: hasValue(collected, 'requiresRemoval'),
    hasIrrigation: hasValue(collected, 'hasIrrigation'),
    irrigation: hasValue(collected, 'hasIrrigation'),
    desiredDate: hasValue(collected, 'desiredDate'),
    budget: hasValue(collected, 'budgetMaxCents') || hasValue(collected, 'budgetMinCents'),
    budgetOrTimeline: hasValue(collected, 'budgetMaxCents') || hasValue(collected, 'desiredDate'),
    sunCondition: hasValue(collected, 'sunCondition'),
    contact: hasValue(collected, 'customerName') && hasValue(collected, 'phone'),
    siteVisit: collected.fields['visitRequested'] === true,
  };
}

function computeMissing(
  collected: CollectedProjectState,
  photoCount: number,
  topics: readonly string[],
): string[] {
  const met = topicMap(collected, photoCount);
  return topics.filter((topic) => met[topic] === false);
}

function inferSignals(collected: CollectedProjectState, message: string): string[] {
  const f = collected.fields;
  const text = `${message} ${String(f['description'] ?? '')}`.toLowerCase();
  const signals = new Set<string>();
  if (/airbnb|renta corta|short.?term|inversi[oó]n/.test(text)) signals.add('investment_property');
  if (/vendo|venta|compr[eé] casa|reci[eé]n compr/.test(text)) signals.add('recent_or_sale_property');
  if (/urgente|esta semana|r[aá]pido|pronto|fecha/.test(text) || hasValue(collected, 'desiredDate')) {
    signals.add('urgency');
  }
  if (/yo decido|soy el dueñ|mi casa|mi negocio/.test(text)) signals.add('decision_maker');
  if (/comercial|negocio|oficina|local|condominio/.test(text) || f['propertyType'] === 'COMMERCIAL') {
    signals.add('commercial_project');
  }
  if (/lujo|premium|moderno|elegante|entrada/.test(text)) signals.add('luxury_customer');
  if (/referid|me recomendaron|cliente de ustedes|otra vez/.test(text)) signals.add('referral_or_repeat');
  if (f['visitRequested'] === true || /visita|pasar|venir/.test(text)) signals.add('requests_visit');
  if (typeof f['computedSquareFeet'] === 'number' && f['computedSquareFeet'] >= 1000) signals.add('large_property');
  return [...signals];
}

function buildOwnerSummary(
  collected: CollectedProjectState,
  photoCount: number,
  inferredSignals: string[],
): Record<string, string> {
  const f = collected.fields;
  const summary: Record<string, string> = {};
  const put = (label: string, value: unknown): void => {
    if (value !== null && value !== undefined && String(value).trim().length > 0) {
      summary[label] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  };
  put('Customer Name', f['customerName']);
  put('Phone', f['phone']);
  put('Email', f['email']);
  put('Municipality', f['municipality']);
  put('Address', f['addressText']);
  put('Project Type', f['serviceType']);
  put('Requested Services', f['description']);
  put('Estimated Area', f['computedSquareFeet'] ?? f['reportedSquareFeet']);
  put('Measurements', hasMeasurements(collected) ? 'known' : 'missing');
  put('Sun Exposure', f['sunCondition']);
  put('Removal Needed', f['requiresRemoval']);
  put('Preferred Style', f['stylePreferences']);
  put('Maintenance Preference', f['lowMaintenancePreferred']);
  put('Budget Clues', f['budgetMaxCents'] ?? f['budgetMinCents']);
  put('Urgency', f['desiredDate']);
  put('Desired Completion Date', f['desiredDate']);
  put('Photos Received', photoCount);
  put('Buying Signals', inferredSignals.join(', '));
  return summary;
}

function waitUntilVisit(missing: string[], optional: string[]): string[] {
  const canWait = new Set(['measurements', 'area', 'sunCondition', 'waterSource', 'pressureKnown']);
  return [...missing, ...optional].filter((item) => canWait.has(item));
}

function estimateProjectSize(collected: CollectedProjectState): string {
  const area = collected.fields['computedSquareFeet'] ?? collected.fields['reportedSquareFeet'];
  if (typeof area !== 'number') return 'unknown';
  if (area >= 1500) return 'large';
  if (area >= 500) return 'medium';
  return 'small';
}

function leadQuality(
  collected: CollectedProjectState,
  photoCount: number,
  signals: readonly string[],
): string {
  const strong = signals.includes('requests_visit') || signals.includes('urgency');
  const complete = hasValue(collected, 'phone') && hasValue(collected, 'municipality');
  if (strong && complete) return 'high';
  if (photoCount > 0 || complete) return 'medium';
  return 'early';
}

function buyingIntent(signals: readonly string[]): string {
  if (signals.includes('requests_visit')) return 'very high';
  if (signals.includes('urgency') || signals.includes('decision_maker')) return 'high';
  return 'developing';
}

function confidenceLabel(collected: CollectedProjectState, photoCount: number): string {
  if (photoCount > 0 && hasValue(collected, 'description')) return 'good';
  if (hasValue(collected, 'description')) return 'moderate';
  return 'early';
}

function materialLabel(service: AiServiceType | null): string {
  if (service === 'LANDSCAPE_DESIGN_INSTALLATION' || service === 'GARDEN_RENOVATION') return 'medium to high';
  if (service === 'IRRIGATION' || service === 'LANDSCAPE_LIGHTING') return 'specialized';
  if (service === 'MAINTENANCE') return 'low recurring';
  return 'unknown';
}

function difficultyLabel(collected: CollectedProjectState, service: AiServiceType | null): string {
  if (collected.fields['hasDrainageConcern'] === true) return 'higher due to drainage concern';
  if (service === 'IRRIGATION' || service === 'LANDSCAPE_LIGHTING') return 'technical';
  if (collected.fields['requiresRemoval'] === true) return 'moderate with removal';
  return 'standard pending site visit';
}

function durationLabel(service: AiServiceType | null, size: string): string {
  if (service === 'MAINTENANCE') return 'recurring';
  if (size === 'large') return 'multi-day likely';
  if (size === 'medium') return 'one to several days';
  return 'pending scope confirmation';
}

function recommendedServices(service: AiServiceType | null): string[] {
  if (service === null) return ['Site visit'];
  const flow = SERVICE_CONVERSATION_FLOWS[service];
  return [flow.label, ...flow.crossSellOpportunities.slice(0, 2)];
}

function possibleRisks(collected: CollectedProjectState, signals: readonly string[]): string[] {
  const risks: string[] = [];
  if (!hasMeasurements(collected)) risks.push('Measurements unknown');
  if (collected.fields['hasDrainageConcern'] === true) risks.push('Drainage concern');
  if (signals.includes('not_decision_maker')) risks.push('Decision maker may be absent');
  if (!hasValue(collected, 'phone')) risks.push('Contact phone missing');
  return risks;
}

function visitPriority(signals: readonly string[], photoCount: number): string {
  if (signals.includes('requests_visit') || signals.includes('urgency')) return 'high';
  if (photoCount > 0) return 'medium';
  return 'normal';
}
