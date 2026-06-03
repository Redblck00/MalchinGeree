-- ══════════════════════════════════════════════════════════════════
-- 002_offline_template_flag.sql
-- contract_templates-д offline горимд ашиглах боломжтой эсэхийг тэмдэглэх flag.
-- Хэрэглэгч offline горим сонгоход зөвхөн энэ flag-тай (true) template-ууд
-- харагдаж, локал (IndexedDB)-д кэшлэгдэнэ.
-- IF NOT EXISTS — fresh DB (000-д аль хэдийн нэмэгдсэн) дээр ч аюулгүй.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS is_offline_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_templates_offline
  ON contract_templates(is_offline_enabled)
  WHERE is_offline_enabled = true;

COMMIT;
