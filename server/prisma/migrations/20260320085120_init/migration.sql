/*
  Warnings:

  - You are about to drop the column `idActive` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `idActive`,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
