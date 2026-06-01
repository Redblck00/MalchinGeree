-- Migration 008: CLOSED status + closed_at + close_reason
-- Creator гэрээг хааж дуусгасны дараа CLOSED статуст шилжинэ.
-- Хэрэглэгчид хоорондоо үнэлгээ өгөх боломж энэ үед нээгдэнэ.
--
-- ⚠ ALTER TYPE ADD VALUE нь өөрийн транзакц шаардлагатай (PostgreSQL).
-- Иймд энэ скрипт-г ажиллуулахдаа psql дотор `BEGIN`-ийг нэгээр нь биш,
-- хоёр алхамаар өгнө.

-- Алхам 1 (transaction-гүй):
ALTER TYPE contract_status_enum
  ADD VALUE IF NOT EXISTS 'CLOSED' AFTER 'COMPLETED';

-- Алхам 2 (шинэ statement):
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_reason TEXT;
