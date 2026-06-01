-- Migration 001: otps хүснэгтэд pending_data багана нэмэх
-- Бүртгэлийн мэдээллийг OTP баталгаажихаас өмнө түр хадгалах зорилготой
-- Ажиллуулах: psql -d e_contract -f migrations/001_otps_add_pending_data.sql

ALTER TABLE otps ADD COLUMN IF NOT EXISTS pending_data JSONB;
