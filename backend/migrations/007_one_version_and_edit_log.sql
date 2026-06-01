-- Migration 007: contract_versions-ийг "нэг гэрээ → нэг version" болгох
-- + contract_edit_log хүснэгт нэмж засварын JSON diff аудит хадгалах
--
-- ШАЛТГААН: Олон version бүрд rendered_content (HTML) хадгалах нь
-- хадгалах хэмжээг ихэсгэж гүйцэтгэлийг удаашруулна. Гарын үсэг
-- зурагдсаны дараа өөрчлөх боломжгүй (lock) учир ганц snapshot хангалттай.

BEGIN;

-- 1. Хэрэв олон row-той гэрээ байвал хамгийн сүүлийнхийг л үлдээх
DELETE FROM contract_versions cv1
  USING contract_versions cv2
  WHERE cv1.contract_id    = cv2.contract_id
    AND cv1.version_number  < cv2.version_number;

-- 2. version_number баганыг хасах + UNIQUE constraint нэмэх
ALTER TABLE contract_versions DROP COLUMN IF EXISTS version_number;
ALTER TABLE contract_versions
  ADD CONSTRAINT uq_contract_one_version UNIQUE (contract_id);

-- 3. contracts.version хасах
ALTER TABLE contracts DROP COLUMN IF EXISTS version;

-- 4. Аудит хүснэгт — JSON diff хадгална
CREATE TABLE IF NOT EXISTS contract_edit_log (
  edit_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id    UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  edited_by      UUID NOT NULL REFERENCES users(user_id),
  changed_fields JSONB NOT NULL,
  -- Жишээ: {
  --   "seller.phone":          { "old": "99...", "new": "88..." },
  --   "payment.total_amount":  { "old": 1000000, "new": 1200000 }
  -- }
  edited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_log_contract
  ON contract_edit_log(contract_id, edited_at DESC);

COMMIT;
