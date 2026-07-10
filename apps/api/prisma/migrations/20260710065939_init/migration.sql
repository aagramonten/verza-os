-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `passwordHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_companyId_email_idx`(`companyId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scoring_configs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `scoring_configs_companyId_active_idx`(`companyId`, `active`),
    UNIQUE INDEX `scoring_configs_companyId_version_key`(`companyId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `municipality` VARCHAR(191) NULL,
    `propertyType` ENUM('RESIDENTIAL', 'COMMERCIAL', 'CONDO', 'OTHER') NULL,
    `source` ENUM('CHAT') NOT NULL DEFAULT 'CHAT',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_companyId_createdAt_idx`(`companyId`, `createdAt`),
    UNIQUE INDEX `customers_companyId_phone_key`(`companyId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('DESIGN_INSTALLATION', 'LAWN', 'IRRIGATION', 'LIGHTING', 'PLANTING', 'CLEANUP', 'MAINTENANCE', 'OTHER') NULL,
    `status` ENUM('DRAFT', 'COLLECTING', 'PENDING_CONFIRMATION', 'READY_FOR_REVIEW', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `requiresRemoval` BOOLEAN NULL,
    `hasIrrigation` BOOLEAN NULL,
    `budgetMinCents` INTEGER NULL,
    `budgetMaxCents` INTEGER NULL,
    `desiredDate` DATETIME(3) NULL,
    `preferredVisitTime` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `adminSummary` JSON NULL,
    `leadScore` INTEGER NULL,
    `confidenceScore` INTEGER NULL,
    `conversionBand` ENUM('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW') NULL,
    `suggestedNextAction` ENUM('SCHEDULE_SITE_VISIT', 'TRUST_FIRST_FOLLOWUP', 'SEND_PRELIMINARY_ESTIMATE', 'REQUEST_MORE_PHOTOS', 'LOW_PRIORITY_FOLLOWUP') NULL,
    `scoreBreakdown` JSON NULL,
    `scoringVersion` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_referenceNumber_key`(`referenceNumber`),
    INDEX `leads_companyId_status_idx`(`companyId`, `status`),
    INDEX `leads_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `state` ENUM('GREETING', 'COLLECTING_SERVICE', 'COLLECTING_DETAILS', 'COLLECTING_MEDIA', 'COLLECTING_MEASURES', 'ESTIMATE_OFFERED', 'SUMMARY_SHOWN', 'CONFIRMED', 'COMPLETED', 'ABANDONED', 'HUMAN_HANDOFF') NOT NULL DEFAULT 'GREETING',
    `language` ENUM('ES', 'EN') NOT NULL DEFAULT 'ES',
    `resumeTokenHash` VARCHAR(191) NOT NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `ipHash` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chat_sessions_resumeTokenHash_key`(`resumeTokenHash`),
    INDEX `chat_sessions_companyId_state_idx`(`companyId`, `state`),
    INDEX `chat_sessions_companyId_lastActivityAt_idx`(`companyId`, `lastActivityAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `role` ENUM('CUSTOMER', 'VERA', 'SYSTEM') NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_companyId_sessionId_createdAt_idx`(`companyId`, `sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_media` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `kind` ENUM('PHOTO') NOT NULL DEFAULT 'PHOTO',
    `storageKey` VARCHAR(191) NOT NULL,
    `thumbKey` VARCHAR(191) NULL,
    `mime` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `uploadedBy` ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_media_companyId_leadId_idx`(`companyId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_measurements` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `lengthFt` DECIMAL(7, 2) NOT NULL,
    `widthFt` DECIMAL(7, 2) NOT NULL,
    `areaSqFt` DECIMAL(10, 2) NOT NULL,
    `source` ENUM('CUSTOMER', 'VERA_EXTRACTED', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_measurements_companyId_leadId_idx`(`companyId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_confirmations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CORRECTED') NOT NULL DEFAULT 'PENDING',
    `confirmedAt` DATETIME(3) NULL,
    `correctionNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_confirmations_companyId_leadId_idx`(`companyId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_extractions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `rawOutput` JSON NOT NULL,
    `validatedOutput` JSON NULL,
    `valid` BOOLEAN NOT NULL,
    `errors` JSON NULL,
    `appliedFields` JSON NULL,
    `latencyMs` INTEGER NOT NULL,
    `tokensIn` INTEGER NULL,
    `tokensOut` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_extractions_companyId_sessionId_createdAt_idx`(`companyId`, `sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricing_rules` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('DESIGN_INSTALLATION', 'LAWN', 'IRRIGATION', 'LIGHTING', 'PLANTING', 'CLEANUP', 'MAINTENANCE', 'OTHER') NOT NULL,
    `unit` ENUM('SQFT', 'FLAT', 'PER_ZONE') NOT NULL,
    `minRateCents` INTEGER NOT NULL,
    `maxRateCents` INTEGER NOT NULL,
    `minimumJobCents` INTEGER NOT NULL,
    `factors` JSON NULL,
    `version` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pricing_rules_companyId_serviceType_active_idx`(`companyId`, `serviceType`, `active`),
    UNIQUE INDEX `pricing_rules_companyId_serviceType_version_key`(`companyId`, `serviceType`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estimate_ranges` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `pricingRuleId` VARCHAR(191) NOT NULL,
    `ruleVersion` INTEGER NOT NULL,
    `inputs` JSON NOT NULL,
    `lowCents` INTEGER NOT NULL,
    `highCents` INTEGER NOT NULL,
    `disclaimerShown` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `estimate_ranges_companyId_leadId_createdAt_idx`(`companyId`, `leadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `actorType` ENUM('CUSTOMER', 'VERA', 'SYSTEM', 'ADMIN') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_companyId_entity_entityId_idx`(`companyId`, `entity`, `entityId`),
    INDEX `audit_logs_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_sessions` ADD CONSTRAINT `chat_sessions_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `chat_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_media` ADD CONSTRAINT `lead_media_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_measurements` ADD CONSTRAINT `project_measurements_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_confirmations` ADD CONSTRAINT `lead_confirmations_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_confirmations` ADD CONSTRAINT `lead_confirmations_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `chat_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_extractions` ADD CONSTRAINT `ai_extractions_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `chat_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_extractions` ADD CONSTRAINT `ai_extractions_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `chat_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_ranges` ADD CONSTRAINT `estimate_ranges_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_ranges` ADD CONSTRAINT `estimate_ranges_pricingRuleId_fkey` FOREIGN KEY (`pricingRuleId`) REFERENCES `pricing_rules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
