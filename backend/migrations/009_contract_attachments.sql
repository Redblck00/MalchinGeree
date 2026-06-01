-- Migration 009: contract_attachments — Гэрээний хавсралт материал
--
-- file_path нь Cloudinary URL (https://res.cloudinary.com/...) хадгална
-- public_id нь Cloudinary дотроос устгах үед хэрэгтэй

BEGIN;

CREATE TABLE IF NOT EXISTS contract_attachments (
  attachment_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id     UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES users(user_id),
  file_name       VARCHAR(255) NOT NULL,    -- эх нэр (test.pdf)
  file_url        VARCHAR(500) NOT NULL,    -- Cloudinary бүтэн URL
  public_id       VARCHAR(255) NOT NULL,    -- Cloudinary delete-д хэрэгтэй
  file_type       VARCHAR(50)  NOT NULL,    -- mime type
  file_size       INTEGER      NOT NULL,    -- bytes
  sort_order      SMALLINT     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_contract
  ON contract_attachments(contract_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_attachments_uploader
  ON contract_attachments(uploaded_by);

COMMIT;
