-- Composite parent keys allow tenant ownership to be enforced by foreign keys.
-- They are harmless if the quote-table preflight fails later.
CREATE UNIQUE INDEX `users_companyId_id_key`
    ON `users`(`companyId`, `id`);

CREATE UNIQUE INDEX `projects_companyId_id_key`
    ON `projects`(`companyId`, `id`);

-- One atomic MySQL DDL statement performs every structural quote-table change.
-- If either tenant-scoped FK finds invalid legacy data, none of the enum,
-- column, FK or index changes in this statement are committed.
ALTER TABLE `official_quotes`
    MODIFY `status` ENUM(
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'SENT',
        'ACCEPTED',
        'REJECTED',
        'EXPIRED',
        'SUPERSEDED'
    ) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `taxRateBps` INTEGER NULL AFTER `subtotalCents`,
    ADD CONSTRAINT `official_quotes_companyId_projectId_fkey`
        FOREIGN KEY (`companyId`, `projectId`)
        REFERENCES `projects`(`companyId`, `id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `official_quotes_companyId_approvedByUserId_fkey`
        FOREIGN KEY (`companyId`, `approvedByUserId`)
        REFERENCES `users`(`companyId`, `id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    DROP FOREIGN KEY `official_quotes_projectId_fkey`,
    DROP FOREIGN KEY `official_quotes_approvedByUserId_fkey`,
    DROP INDEX `official_quotes_approvedByUserId_fkey`;

-- Legacy taxed quotes remain NULL because their original rate cannot be
-- inferred safely from a rounded tax amount. Zero-tax rows can be backfilled
-- exactly. Every quote created by the new application stores an explicit rate.
UPDATE `official_quotes`
SET `taxRateBps` = 0
WHERE `taxCents` = 0;
