-- CreateTable
CREATE TABLE `customer_auth_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `purpose` ENUM('PORTAL_LOGIN') NOT NULL DEFAULT 'PORTAL_LOGIN',
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `ipHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_auth_tokens_tokenHash_key`(`tokenHash`),
    INDEX `customer_auth_tokens_companyId_customerId_idx`(`companyId`, `customerId`),
    INDEX `customer_auth_tokens_companyId_expiresAt_idx`(`companyId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NOT NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_sessions_tokenHash_key`(`tokenHash`),
    INDEX `customer_sessions_companyId_customerId_idx`(`companyId`, `customerId`),
    INDEX `customer_sessions_companyId_expiresAt_idx`(`companyId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customers_companyId_email_idx` ON `customers`(`companyId`, `email`);

-- AddForeignKey
ALTER TABLE `customer_auth_tokens` ADD CONSTRAINT `customer_auth_tokens_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
