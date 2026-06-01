-- Migration 005: blockchain_ledger — fake blockchain simulation
-- Гэрээ COMPLETED болоход block үүсгэж хэлхээ хэлбэрээр SHA-256 hash-аар
-- холбож хадгална. Дараа жинхэнэ Ethereum/Polygon-руу шилжихэд бэлэн.

CREATE TABLE IF NOT EXISTS blockchain_ledger (
  block_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_number    INTEGER NOT NULL UNIQUE,
  previous_hash   VARCHAR(64) NOT NULL,
  contract_id     UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  contract_hash   VARCHAR(64) NOT NULL,    -- rendered_hash-аас
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_hash      VARCHAR(64) NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_contract
  ON blockchain_ledger(contract_id);

CREATE INDEX IF NOT EXISTS idx_bc_block_number
  ON blockchain_ledger(block_number DESC);
