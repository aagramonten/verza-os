/*
  Warnings:

  - You are about to alter the column `state` on the `chat_sessions` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `Enum(EnumId(7))`.

*/
-- AlterTable
ALTER TABLE `chat_sessions` ADD COLUMN `resumeTokenRevokedAt` DATETIME(3) NULL,
    MODIFY `state` ENUM('STARTED', 'COLLECTING_CONTACT', 'COLLECTING_PROJECT', 'COLLECTING_MEDIA', 'COLLECTING_MEASUREMENTS', 'READY_FOR_CONFIRMATION', 'CONFIRMED', 'ABANDONED') NOT NULL DEFAULT 'STARTED';
