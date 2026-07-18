-- AlterTable
ALTER TABLE `leads` ADD COLUMN `followUpStatus` ENUM('NEW', 'CONTACTED', 'IN_FOLLOW_UP', 'CLOSED') NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX `leads_companyId_followUpStatus_idx` ON `leads`(`companyId`, `followUpStatus`);
