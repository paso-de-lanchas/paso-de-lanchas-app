-- DropIndex
DROP INDEX "vehicles_owner_id_plate_key";

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_owner_id_plate_key" ON "vehicles"("owner_id", "plate") WHERE "deleted_at" IS NULL;
