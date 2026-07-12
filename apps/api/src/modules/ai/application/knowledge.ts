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

export interface ServiceConversationFlow {
  label: string;
  requiredInformation: readonly string[];
  optionalInformation: readonly string[];
  questionPriority: readonly string[];
  typicalConcerns: readonly string[];
  crossSellOpportunities: readonly string[];
  closingStrategy: string;
}

export interface KnowledgeTopic {
  name: string;
  guidance: string;
}

export interface KnowledgeBundle {
  service: ServiceConversationFlow | null;
  designPrinciples: readonly KnowledgeTopic[];
  plants: readonly KnowledgeTopic[];
  materials: readonly KnowledgeTopic[];
  upsellRules: readonly KnowledgeTopic[];
  conversationTips: readonly string[];
}

export const SERVICE_CONVERSATION_FLOWS: Readonly<
  Record<AiServiceType, ServiceConversationFlow>
> = {
  LANDSCAPE_DESIGN_INSTALLATION: {
    label: 'Garden Design',
    requiredInformation: ['vision', 'municipality', 'propertyType', 'projectArea', 'photos', 'contact'],
    optionalInformation: ['stylePreferences', 'sunCondition', 'maintenancePreference', 'budget', 'timeline'],
    questionPriority: [
      'vision',
      'municipality',
      'propertyType',
      'projectArea',
      'photos',
      'stylePreferences',
      'maintenancePreference',
      'budgetOrTimeline',
      'siteVisit',
    ],
    typicalConcerns: ['No saber qué estilo o plantas escoger', 'Costo final', 'Mantenimiento futuro'],
    crossSellOpportunities: ['Premium plants', 'Irrigation', 'Landscape lighting', 'Maintenance plan'],
    closingStrategy:
      'Presenta la visita como una sesión consultiva para caminar el área, validar sol/sombra y proponer fases.',
  },
  GARDEN_RENOVATION: {
    label: 'Landscape Renovation',
    requiredInformation: ['currentCondition', 'desiredChange', 'municipality', 'photos', 'contact'],
    optionalInformation: ['removalNeeded', 'plantsToKeep', 'stylePreferences', 'budget', 'timeline'],
    questionPriority: [
      'description',
      'photos',
      'requiresRemoval',
      'municipality',
      'stylePreferences',
      'lowMaintenancePreferred',
      'siteVisit',
    ],
    typicalConcerns: ['Qué se puede salvar', 'Cuánto hay que remover', 'Cómo modernizar sin rehacer todo'],
    crossSellOpportunities: ['Decorative rock', 'Ground cover', 'Lighting for existing palms', 'Maintenance plan'],
    closingStrategy:
      'Recomienda una visita para decidir qué conservar, qué limpiar y cómo renovar por etapas.',
  },
  LAWN_INSTALLATION: {
    label: 'Natural Grass Installation',
    requiredInformation: ['area', 'municipality', 'sunCondition', 'removalNeeded', 'contact'],
    optionalInformation: ['photos', 'irrigation', 'drainage', 'grassPreference', 'timeline'],
    questionPriority: [
      'measurements',
      'photos',
      'requiresRemoval',
      'sunCondition',
      'hasIrrigation',
      'desiredDate',
      'siteVisit',
    ],
    typicalConcerns: ['Medidas desconocidas', 'Sol fuerte', 'Riego', 'Preparación del terreno'],
    crossSellOpportunities: ['Irrigation protects the grass investment', 'Cleanup/removal', 'Maintenance plan'],
    closingStrategy:
      'Explica que la visita confirma nivelación, drenaje y riego antes del precio final.',
  },
  IRRIGATION: {
    label: 'Irrigation Systems',
    requiredInformation: ['newOrRepair', 'areasToCover', 'waterSource', 'municipality', 'contact'],
    optionalInformation: ['zones', 'pressureKnown', 'photos', 'lawnOrBeds', 'timeline'],
    questionPriority: [
      'description',
      'projectArea',
      'hasIrrigation',
      'photos',
      'sunCondition',
      'siteVisit',
    ],
    typicalConcerns: ['Presión de agua', 'Cobertura pareja', 'Daño a grama o plantas existentes'],
    crossSellOpportunities: ['Natural grass', 'Planting beds', 'Maintenance plan'],
    closingStrategy:
      'Enfatiza que la visita técnica valida presión, zonas y cobertura para evitar desperdicio de agua.',
  },
  LANDSCAPE_LIGHTING: {
    label: 'Landscape Lighting',
    requiredInformation: ['areasToLight', 'styleGoal', 'photos', 'municipality', 'contact'],
    optionalInformation: ['existingPower', 'featurePlants', 'walkways', 'budget', 'timeline'],
    questionPriority: ['projectArea', 'photos', 'stylePreferences', 'description', 'siteVisit'],
    typicalConcerns: ['Cómo se verá de noche', 'Electricidad existente', 'Seguridad y ambiente'],
    crossSellOpportunities: ['Large palms', 'Entrance design', 'Premium plants'],
    closingStrategy:
      'Vende la visita como el momento para identificar puntos focales, seguridad y efecto visual nocturno.',
  },
  PLANTING: {
    label: 'Plant Replacement',
    requiredInformation: ['plantsToReplace', 'sunCondition', 'municipality', 'photos', 'contact'],
    optionalInformation: ['petSafety', 'children', 'maintenancePreference', 'stylePreferences'],
    questionPriority: ['photos', 'sunCondition', 'lowMaintenancePreferred', 'plantPreferences', 'siteVisit'],
    typicalConcerns: ['Plantas que sobrevivan', 'Mantenimiento', 'Mascotas o niños'],
    crossSellOpportunities: ['Decorative rock', 'Mulch', 'Irrigation drip line', 'Maintenance plan'],
    closingStrategy:
      'Recomienda la visita para escoger plantas según sol, drenaje y mantenimiento real.',
  },
  CLEANUP_REMOVAL: {
    label: 'Garden Cleanup',
    requiredInformation: ['photos', 'whatToRemove', 'access', 'municipality', 'contact'],
    optionalInformation: ['haulAway', 'urgency', 'followUpDesign', 'maintenanceInterest'],
    questionPriority: ['photos', 'description', 'requiresRemoval', 'desiredDate', 'siteVisit'],
    typicalConcerns: ['Rapidez', 'Volumen de escombros', 'Acceso al área'],
    crossSellOpportunities: ['Renovation after cleanup', 'Maintenance plan', 'Decorative rock'],
    closingStrategy:
      'Usa fotos para orientar el alcance y propone visita rápida si hay urgencia o acceso complejo.',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    requiredInformation: ['propertySize', 'currentCondition', 'frequency', 'municipality', 'contact'],
    optionalInformation: ['photos', 'servicesIncluded', 'startDate', 'problemAreas'],
    questionPriority: ['propertyType', 'photos', 'description', 'desiredDate', 'siteVisit'],
    typicalConcerns: ['Consistencia', 'Frecuencia correcta', 'Costo mensual'],
    crossSellOpportunities: ['Initial cleanup', 'Plant replacement', 'Irrigation repair'],
    closingStrategy:
      'Presenta la primera visita como evaluación para fijar frecuencia y propuesta mensual.',
  },
  DECORATIVE_ROCK_MULCH: {
    label: 'Decorative Rock / Ground Cover',
    requiredInformation: ['area', 'materialPreference', 'municipality', 'photos', 'contact'],
    optionalInformation: ['weedBarrier', 'sunCondition', 'stylePreferences', 'maintenancePreference'],
    questionPriority: ['measurements', 'photos', 'stylePreferences', 'lowMaintenancePreferred', 'siteVisit'],
    typicalConcerns: ['Calor', 'Maleza', 'Cantidad de material'],
    crossSellOpportunities: ['Ground cover', 'Low-maintenance plants', 'Lighting'],
    closingStrategy:
      'Explica que la visita valida medidas, bordes y preparación para que el material rinda bien.',
  },
  OTHER: {
    label: 'Commercial Landscaping',
    requiredInformation: ['scope', 'propertyType', 'municipality', 'photos', 'contact'],
    optionalInformation: ['siteAccess', 'timeline', 'decisionMaker', 'maintenanceNeed'],
    questionPriority: ['description', 'propertyType', 'municipality', 'photos', 'siteVisit'],
    typicalConcerns: ['Coordinación', 'Imagen del negocio', 'Mantenimiento continuo'],
    crossSellOpportunities: ['Maintenance plan', 'Lighting', 'Irrigation'],
    closingStrategy:
      'Recomienda visita para entender flujo de clientes, acceso y mantenimiento del espacio.',
  },
};

export const DESIGN_KNOWLEDGE: readonly KnowledgeTopic[] = [
  {
    name: 'Modern Gardens',
    guidance:
      'Usan líneas limpias, masas de plantas repetidas, piedra decorativa y puntos focales definidos.',
  },
  {
    name: 'Luxury Gardens',
    guidance:
      'Se apoyan en palmas, iluminación, plantas premium y acabados limpios que elevan la entrada o terraza.',
  },
  {
    name: 'Minimalist Gardens',
    guidance:
      'Reducen variedad de plantas y priorizan estructura, piedra, bordes definidos y bajo mantenimiento.',
  },
  {
    name: 'Tropical Gardens',
    guidance:
      'Funcionan bien en Puerto Rico con follaje, heliconias, palmas y capas de textura adaptadas al sol y lluvia.',
  },
  {
    name: 'Low Maintenance Gardens',
    guidance:
      'Combinan plantas resistentes, ground cover, piedra decorativa o mulch para bajar limpieza y riego frecuente.',
  },
  {
    name: 'Pet Friendly Gardens',
    guidance:
      'Requieren confirmar mascotas antes de recomendar plantas específicas; prioriza materiales resistentes y áreas transitables.',
  },
  {
    name: 'Kid Friendly Gardens',
    guidance:
      'Priorizan circulación segura, superficies estables, plantas no agresivas y visibilidad para supervisión.',
  },
  {
    name: 'Puerto Rico Climate',
    guidance:
      'El sol fuerte, humedad y lluvias intensas hacen importantes el drenaje, riego correcto y plantas adaptadas.',
  },
  {
    name: 'Heavy Rain',
    guidance:
      'Puede afectar drenaje, erosión y estabilidad de mulch; conviene preguntar por áreas donde se empoza el agua.',
  },
  {
    name: 'Full Sun / Partial Shade',
    guidance:
      'La selección de grama y plantas depende mucho de si el área recibe sol directo, sol parcial o sombra.',
  },
];

export const PLANT_KNOWLEDGE: readonly KnowledgeTopic[] = [
  { name: 'Blue Daze', guidance: 'Buena opción ornamental baja para áreas soleadas con color azul.' },
  {
    name: 'Heliconias',
    guidance: 'Aportan un look tropical fuerte y funcionan mejor donde el espacio permite volumen.',
  },
  {
    name: 'Topiaries',
    guidance: 'Dan estructura formal y requieren mantenimiento para conservar la forma.',
  },
  {
    name: 'Ficus Green Island',
    guidance: 'Se usa como masa verde compacta y puede funcionar en diseños limpios de bajo mantenimiento.',
  },
  {
    name: 'Agaves',
    guidance: 'Aportan forma arquitectónica y toleran sol, pero hay que considerar puntas y tránsito de niños o mascotas.',
  },
  {
    name: 'Palms',
    guidance: 'Crean impacto vertical y combinan muy bien con iluminación de paisaje.',
  },
];

export const MATERIAL_KNOWLEDGE: readonly KnowledgeTopic[] = [
  {
    name: 'Decorative Rock',
    guidance: 'Ayuda a lograr un jardín limpio y de bajo mantenimiento si se prepara bien el área.',
  },
  {
    name: 'Mulch',
    guidance: 'Mejora apariencia y humedad del suelo, pero puede requerir refrescarse con el tiempo.',
  },
  {
    name: 'Ground Cover',
    guidance: 'Puede reducir áreas de tierra expuesta y mantenimiento cuando el cliente busca algo práctico.',
  },
  {
    name: 'Natural Grass',
    guidance: 'La inversión dura más cuando hay buena preparación de terreno, drenaje y riego.',
  },
  {
    name: 'Irrigation Systems',
    guidance: 'Protegen grama y plantas al dar agua más consistente, especialmente en áreas de sol fuerte.',
  },
  {
    name: 'Maintenance Plans',
    guidance: 'Mantienen el jardín estable y evitan recuperaciones costosas por abandono.',
  },
];

export const UPSELL_RULES: readonly KnowledgeTopic[] = [
  { name: 'Natural Grass -> Irrigation', guidance: 'Recomienda riego como protección de la inversión.' },
  { name: 'Large Palms -> Lighting', guidance: 'Sugiere iluminación para destacar palmas y entradas.' },
  { name: 'Luxury Garden -> Premium Plants', guidance: 'Sugiere plantas premium y composición por capas.' },
  { name: 'Large Property -> Maintenance Plan', guidance: 'Sugiere mantenimiento para sostener el valor del proyecto.' },
  { name: 'Low Maintenance -> Ground Cover', guidance: 'Sugiere ground cover, piedra o plantas resistentes.' },
];
