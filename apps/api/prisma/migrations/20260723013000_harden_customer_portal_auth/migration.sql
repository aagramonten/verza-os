-- Tenant-owned authentication records must not be able to reference a
-- customer from a different company, even through a direct database write.
ALTER TABLE `customer_auth_tokens`
    DROP FOREIGN KEY `customer_auth_tokens_customerId_fkey`;

ALTER TABLE `customer_sessions`
    DROP FOREIGN KEY `customer_sessions_customerId_fkey`;

CREATE UNIQUE INDEX `customers_companyId_id_key`
    ON `customers`(`companyId`, `id`);

ALTER TABLE `customer_auth_tokens`
    ADD CONSTRAINT `customer_auth_tokens_companyId_customerId_fkey`
    FOREIGN KEY (`companyId`, `customerId`)
    REFERENCES `customers`(`companyId`, `id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `customer_sessions`
    ADD CONSTRAINT `customer_sessions_companyId_customerId_fkey`
    FOREIGN KEY (`companyId`, `customerId`)
    REFERENCES `customers`(`companyId`, `id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
