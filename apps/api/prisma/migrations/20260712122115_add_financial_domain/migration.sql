-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `serviceType` ENUM('DESIGN_INSTALLATION', 'LAWN', 'IRRIGATION', 'LIGHTING', 'PLANTING', 'CLEANUP', 'MAINTENANCE', 'OTHER') NULL,
    `status` ENUM('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `scope` TEXT NULL,
    `notes` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `contractAmountCents` INTEGER NULL,
    `contractSignedAt` DATETIME(3) NULL,
    `wonAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projects_referenceNumber_key`(`referenceNumber`),
    INDEX `projects_companyId_status_idx`(`companyId`, `status`),
    INDEX `projects_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `projects_companyId_serviceType_idx`(`companyId`, `serviceType`),
    INDEX `projects_companyId_leadId_idx`(`companyId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `official_quotes` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `lineItems` JSON NULL,
    `subtotalCents` INTEGER NOT NULL,
    `taxCents` INTEGER NOT NULL DEFAULT 0,
    `totalCents` INTEGER NOT NULL,
    `validUntil` DATETIME(3) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `official_quotes_companyId_projectId_idx`(`companyId`, `projectId`),
    INDEX `official_quotes_companyId_status_idx`(`companyId`, `status`),
    UNIQUE INDEX `official_quotes_projectId_version_key`(`projectId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_costs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `category` ENUM('PLANTS', 'SOIL', 'MULCH', 'DECORATIVE_ROCK', 'IRRIGATION', 'LIGHTING', 'GRASS', 'EQUIPMENT_RENTAL', 'FUEL', 'LABOR', 'DISPOSAL', 'MARKETING', 'MISCELLANEOUS') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `unitCostCents` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `purchaseDate` DATETIME(3) NOT NULL,
    `receiptKey` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_costs_companyId_projectId_idx`(`companyId`, `projectId`),
    INDEX `project_costs_companyId_category_idx`(`companyId`, `category`),
    INDEX `project_costs_companyId_purchaseDate_idx`(`companyId`, `purchaseDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_spends` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `channel` ENUM('FACEBOOK_ADS', 'INSTAGRAM_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS', 'REFERRAL', 'OTHER') NOT NULL,
    `description` VARCHAR(191) NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `spentAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `campaignRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `marketing_spends_companyId_spentAt_idx`(`companyId`, `spentAt`),
    INDEX `marketing_spends_companyId_projectId_idx`(`companyId`, `projectId`),
    INDEX `marketing_spends_companyId_channel_idx`(`companyId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `method` ENUM('CASH', 'ATH_MOVIL', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER') NOT NULL,
    `type` ENUM('DEPOSIT', 'PROGRESS', 'FINAL', 'REFUND') NOT NULL DEFAULT 'PROGRESS',
    `reference` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_companyId_projectId_idx`(`companyId`, `projectId`),
    INDEX `payments_companyId_receivedAt_idx`(`companyId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `official_quotes` ADD CONSTRAINT `official_quotes_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `official_quotes` ADD CONSTRAINT `official_quotes_approvedByUserId_fkey` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_spends` ADD CONSTRAINT `marketing_spends_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
