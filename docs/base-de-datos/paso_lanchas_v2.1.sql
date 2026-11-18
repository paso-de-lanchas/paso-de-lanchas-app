-- =============================================================================
-- Paso de Lanchas Coatzacoalcos <-> Villa Allende
-- Script completo de la base de datos (modelo relacional v2.1, 32 tablas, PostgreSQL 17)
--
-- ARCHIVO DE CONSULTA. Es una copia de prisma/migrations/*_init/migration.sql.
-- La fuente de verdad es prisma/schema.prisma + las migraciones; para crear la base
-- en desarrollo usa `npm run db:migrate`, no este archivo.
--
-- Si quieres ejecutarlo a mano (pgAdmin, Adminer, psql) en una base VACIA:
--   CREATE DATABASE paso_lanchas;   -- y luego conectate a ella y ejecuta todo lo de abajo
-- =============================================================================

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PASSENGER', 'DRIVER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "token_purpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('PENDING', 'APPROVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('STUDENT', 'INAPAM');

-- CreateEnum
CREATE TYPE "discount_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "txn_type" AS ENUM ('TOPUP_CASH', 'TOPUP_ONLINE', 'FARE_CHARGE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('MERCADO_PAGO', 'STRIPE');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "vessel_kind" AS ENUM ('BOAT', 'FERRY');

-- CreateEnum
CREATE TYPE "vessel_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'SEIZED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "departure_status" AS ENUM ('QUEUED', 'BOARDING', 'BOARDING_CLOSED', 'IN_TRANSIT', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "fare_category" AS ENUM ('GENERAL', 'STUDENT', 'INAPAM', 'PEDESTRIAN', 'VEHICLE');

-- CreateEnum
CREATE TYPE "boarding_payment" AS ENUM ('BALANCE', 'CASH');

-- CreateEnum
CREATE TYPE "boarding_status" AS ENUM ('BOARDED', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "sale_channel" AS ENUM ('QR_BALANCE', 'TICKET_OFFICE');

-- CreateEnum
CREATE TYPE "incident_action" AS ENUM ('REASSIGN', 'REFUND');

-- CreateEnum
CREATE TYPE "waitlist_status" AS ENUM ('WAITING', 'BOARDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "override_type" AS ENUM ('SUSPENSION', 'EXTRA_SERVICE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "photo_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'PASSENGER',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "dock_id" UUID,
    "email_verified_at" TIMESTAMPTZ(6),
    "privacy_accepted_at" TIMESTAMPTZ(6),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" "token_purpose" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "session_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dock_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "device_token_hash" TEXT NOT NULL,
    "status" "device_status" NOT NULL DEFAULT 'PENDING',
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),

    CONSTRAINT "authorized_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "fares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vessel_kind" "vessel_kind" NOT NULL,
    "category" "fare_category" NOT NULL,
    "vehicle_type_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,

    CONSTRAINT "fares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dock_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "opens_at" TIME(0) NOT NULL,
    "closes_at" TIME(0) NOT NULL,

    CONSTRAINT "service_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dock_service_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dock_id" UUID NOT NULL,
    "type" "override_type" NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,

    CONSTRAINT "dock_service_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dock_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "message" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "credential_photo_url" TEXT NOT NULL,
    "status" "discount_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "totp_secret_enc" BYTEA NOT NULL,
    "device_label" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "qr_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "brand" VARCHAR(40) NOT NULL,
    "model" VARCHAR(40) NOT NULL,
    "color" VARCHAR(30) NOT NULL,
    "plate" VARCHAR(15) NOT NULL,
    "photo_url" TEXT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "type" "txn_type" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "sale_id" UUID,
    "payment_id" UUID,
    "cash_shift_id" UUID,
    "performed_by" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_payment_id" VARCHAR(80),
    "idempotency_key" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "dock_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "cash_total" DECIMAL(10,2),

    CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "sale_channel" NOT NULL,
    "passenger_id" UUID,
    "registered_by" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "cash_shift_id" UUID,
    "payment_method" "boarding_payment" NOT NULL,
    "ticket_count" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "docks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "vessel_kind" NOT NULL,
    "registration" VARCHAR(30) NOT NULL,
    "color" VARCHAR(30),
    "photo_url" TEXT,
    "passenger_capacity" INTEGER NOT NULL,
    "status" "vessel_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vessel_id" UUID NOT NULL,
    "from_status" "vessel_status" NOT NULL,
    "to_status" "vessel_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vessel_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(6),

    CONSTRAINT "vessel_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_vehicle_capacity" (
    "vessel_id" UUID NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "vessel_vehicle_capacity_pkey" PRIMARY KEY ("vessel_id","vehicle_type_id")
);

-- CreateTable
CREATE TABLE "departures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vessel_id" UUID NOT NULL,
    "driver_id" UUID,
    "origin_dock_id" UUID NOT NULL,
    "destination_dock_id" UUID NOT NULL,
    "status" "departure_status" NOT NULL DEFAULT 'QUEUED',
    "queue_position" INTEGER,
    "passenger_capacity" INTEGER NOT NULL,
    "occupied_seats" INTEGER NOT NULL DEFAULT 0,
    "return_of_id" UUID,
    "boarding_started_at" TIMESTAMPTZ(6),
    "boarding_closed_at" TIMESTAMPTZ(6),
    "departed_at" TIMESTAMPTZ(6),
    "arrived_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "started_by" UUID,
    "finished_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departure_vehicle_capacity" (
    "departure_id" UUID NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupied" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "departure_vehicle_capacity_pkey" PRIMARY KEY ("departure_id","vehicle_type_id")
);

-- CreateTable
CREATE TABLE "boardings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "departure_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "passenger_id" UUID,
    "vehicle_id" UUID,
    "seat_number" INTEGER NOT NULL,
    "fare_id" UUID NOT NULL,
    "fare_category" "fare_category" NOT NULL,
    "amount_charged" DECIMAL(10,2) NOT NULL,
    "qr_credential_id" UUID,
    "qr_time_step" BIGINT,
    "ticket_code" VARCHAR(12),
    "status" "boarding_status" NOT NULL DEFAULT 'BOARDED',
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vessel_id" UUID NOT NULL,
    "departure_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL,
    "action" "incident_action" NOT NULL,
    "reported_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dock_id" UUID NOT NULL,
    "passenger_id" UUID,
    "label" VARCHAR(80),
    "status" "waitlist_status" NOT NULL DEFAULT 'WAITING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "origin_boarding_id" UUID,
    "boarding_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_locations" (
    "id" BIGSERIAL NOT NULL,
    "departure_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "speed_kmh" DECIMAL(5,1),
    "heading" DECIMAL(5,1),
    "accuracy_m" DECIMAL(6,1),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_devices_device_token_hash_key" ON "authorized_devices"("device_token_hash");

-- CreateIndex
CREATE INDEX "authorized_devices_dock_id_status_idx" ON "authorized_devices"("dock_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "fares_vessel_kind_category_valid_from_idx" ON "fares"("vessel_kind", "category", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "service_hours_dock_id_weekday_key" ON "service_hours"("dock_id", "weekday");

-- CreateIndex
CREATE INDEX "dock_service_overrides_dock_id_starts_at_idx" ON "dock_service_overrides"("dock_id", "starts_at");

-- CreateIndex
CREATE INDEX "announcements_starts_at_idx" ON "announcements"("starts_at");

-- CreateIndex
CREATE INDEX "discount_requests_status_created_at_idx" ON "discount_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "discount_requests_user_id_idx" ON "discount_requests"("user_id");

-- CreateIndex
CREATE INDEX "qr_credentials_user_id_idx" ON "qr_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_owner_id_plate_key" ON "vehicles"("owner_id", "plate");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_wallet_id_created_at_idx" ON "payments"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_shifts_dock_id_opened_at_idx" ON "cash_shifts"("dock_id", "opened_at");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sales_cash_shift_id_idx" ON "sales"("cash_shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "docks_code_key" ON "docks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_code_key" ON "vessels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vessels_registration_key" ON "vessels"("registration");

-- CreateIndex
CREATE INDEX "vessels_status_idx" ON "vessels"("status");

-- CreateIndex
CREATE INDEX "vessel_status_history_vessel_id_changed_at_idx" ON "vessel_status_history"("vessel_id", "changed_at");

-- CreateIndex
CREATE INDEX "vessel_drivers_driver_id_idx" ON "vessel_drivers"("driver_id");

-- CreateIndex
CREATE INDEX "vessel_drivers_vessel_id_idx" ON "vessel_drivers"("vessel_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_types_name_key" ON "vehicle_types"("name");

-- CreateIndex
CREATE INDEX "departures_origin_dock_id_status_queue_position_idx" ON "departures"("origin_dock_id", "status", "queue_position");

-- CreateIndex
CREATE INDEX "departures_vessel_id_created_at_idx" ON "departures"("vessel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "boardings_ticket_code_key" ON "boardings"("ticket_code");

-- CreateIndex
CREATE INDEX "boardings_sale_id_idx" ON "boardings"("sale_id");

-- CreateIndex
CREATE INDEX "boardings_passenger_id_created_at_idx" ON "boardings"("passenger_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "boardings_qr_credential_id_qr_time_step_key" ON "boardings"("qr_credential_id", "qr_time_step");

-- CreateIndex
CREATE UNIQUE INDEX "boardings_departure_id_seat_number_key" ON "boardings"("departure_id", "seat_number");

-- CreateIndex
CREATE INDEX "incidents_vessel_id_created_at_idx" ON "incidents"("vessel_id", "created_at");

-- CreateIndex
CREATE INDEX "waitlist_entries_dock_id_status_priority_created_at_idx" ON "waitlist_entries"("dock_id", "status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "trip_locations_departure_id_recorded_at_idx" ON "trip_locations"("departure_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "authorized_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_devices" ADD CONSTRAINT "authorized_devices_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_devices" ADD CONSTRAINT "authorized_devices_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_devices" ADD CONSTRAINT "authorized_devices_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "authorized_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fares" ADD CONSTRAINT "fares_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fares" ADD CONSTRAINT "fares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_service_overrides" ADD CONSTRAINT "dock_service_overrides_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_service_overrides" ADD CONSTRAINT "dock_service_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_credentials" ADD CONSTRAINT "qr_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "authorized_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "authorized_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_status_history" ADD CONSTRAINT "vessel_status_history_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_status_history" ADD CONSTRAINT "vessel_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_drivers" ADD CONSTRAINT "vessel_drivers_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_drivers" ADD CONSTRAINT "vessel_drivers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_vehicle_capacity" ADD CONSTRAINT "vessel_vehicle_capacity_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_vehicle_capacity" ADD CONSTRAINT "vessel_vehicle_capacity_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_origin_dock_id_fkey" FOREIGN KEY ("origin_dock_id") REFERENCES "docks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_destination_dock_id_fkey" FOREIGN KEY ("destination_dock_id") REFERENCES "docks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_return_of_id_fkey" FOREIGN KEY ("return_of_id") REFERENCES "departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_finished_by_fkey" FOREIGN KEY ("finished_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_vehicle_capacity" ADD CONSTRAINT "departure_vehicle_capacity_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_vehicle_capacity" ADD CONSTRAINT "departure_vehicle_capacity_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_fare_id_fkey" FOREIGN KEY ("fare_id") REFERENCES "fares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_qr_credential_id_fkey" FOREIGN KEY ("qr_credential_id") REFERENCES "qr_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_origin_boarding_id_fkey" FOREIGN KEY ("origin_boarding_id") REFERENCES "boardings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_boarding_id_fkey" FOREIGN KEY ("boarding_id") REFERENCES "boardings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Reglas de integridad que Prisma no sabe expresar (escritas a mano).
-- Ver "Reglas de integridad" en el modelo relacional v2.1.
-- =============================================================================

-- Regla 3: el saldo nunca es negativo.
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- Montos y capacidades válidos.
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "fares" ADD CONSTRAINT "fares_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "fares" ADD CONSTRAINT "fares_valid_range" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_capacity_positive" CHECK ("passenger_capacity" > 0);
ALTER TABLE "vessel_vehicle_capacity" ADD CONSTRAINT "vvc_capacity_non_negative" CHECK ("capacity" >= 0);
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_range" CHECK ("closes_at" > "opens_at");
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_amount_non_negative" CHECK ("amount_charged" >= 0);
ALTER TABLE "boardings" ADD CONSTRAINT "boardings_seat_positive" CHECK ("seat_number" > 0);

-- Regla 1: cero sobreventa (última defensa; la transacción del escaneo es la primera).
ALTER TABLE "departures" ADD CONSTRAINT "departures_seats_within_capacity"
  CHECK ("occupied_seats" >= 0 AND "occupied_seats" <= "passenger_capacity");
ALTER TABLE "departures" ADD CONSTRAINT "departures_distinct_docks"
  CHECK ("origin_dock_id" <> "destination_dock_id");
ALTER TABLE "departure_vehicle_capacity" ADD CONSTRAINT "dvc_occupied_within_capacity"
  CHECK ("capacity" >= 0 AND "occupied" >= 0 AND "occupied" <= "capacity");

-- Regla 11: una venta tiene al menos un boleto (el máximo vive en system_settings).
ALTER TABLE "sales" ADD CONSTRAINT "sales_ticket_count_positive" CHECK ("ticket_count" >= 1);
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_non_negative" CHECK ("total_amount" >= 0);

-- Lista de espera: con cuenta (passenger_id) o con nombre (label).
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_passenger_or_label"
  CHECK ("passenger_id" IS NOT NULL OR "label" IS NOT NULL);
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_priority_non_negative" CHECK ("priority" >= 0);

-- Regla 2: un pasajero no puede estar abordado dos veces en la misma salida.
CREATE UNIQUE INDEX "boardings_one_active_per_passenger"
  ON "boardings" ("departure_id", "passenger_id")
  WHERE "status" = 'BOARDED' AND "passenger_id" IS NOT NULL;

-- Regla 5: una sola salida abordando por muelle.
CREATE UNIQUE INDEX "departures_one_boarding_per_dock"
  ON "departures" ("origin_dock_id") WHERE "status" = 'BOARDING';

-- Regla 6: un solo viaje en tránsito por chofer.
CREATE UNIQUE INDEX "departures_one_trip_per_driver"
  ON "departures" ("driver_id") WHERE "status" = 'IN_TRANSIT' AND "driver_id" IS NOT NULL;

-- Una sola caja abierta por administrador.
CREATE UNIQUE INDEX "cash_shifts_one_open_per_admin"
  ON "cash_shifts" ("admin_id") WHERE "closed_at" IS NULL;

-- Una sola credencial QR vigente por pasajero.
CREATE UNIQUE INDEX "qr_credentials_one_active_per_user"
  ON "qr_credentials" ("user_id") WHERE "revoked_at" IS NULL;

-- Regla 7: sin traslapes de tarifa vigente por (tipo de embarcación, categoría, tipo de vehículo).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "fares" ADD CONSTRAINT "fares_no_overlap" EXCLUDE USING gist (
  "vessel_kind" WITH =,
  "category" WITH =,
  (COALESCE("vehicle_type_id", 0)) WITH =,
  tstzrange("valid_from", "valid_to") WITH &&
);

-- Regla 9: la bitácora de auditoría es inmutable (solo INSERT).
CREATE OR REPLACE FUNCTION "audit_logs_block_changes"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es de solo inserción';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_changes"();
