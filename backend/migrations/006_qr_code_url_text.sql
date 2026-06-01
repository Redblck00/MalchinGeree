-- Migration 006: contract_versions.qr_code_url-ийг TEXT болгох
-- Шалтгаан: QR код нь base64 data URL хэлбэрээр хадгалагдах ба ~2KB+
-- (data:image/png;base64,...) — VARCHAR(500) хүрэлцэхгүй.

ALTER TABLE contract_versions
  ALTER COLUMN qr_code_url TYPE TEXT;
