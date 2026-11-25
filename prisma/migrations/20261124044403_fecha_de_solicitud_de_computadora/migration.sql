-- Issue #42: el superadministrador ve cuándo se pidió cada computadora. Las que ya existían
-- quedan con la fecha de esta migración.
-- AlterTable
ALTER TABLE "authorized_devices" ADD COLUMN     "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
