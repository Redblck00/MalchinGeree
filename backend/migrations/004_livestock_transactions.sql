-- Migration 004: livestock_transactions хүснэгт
-- Гэрээ COMPLETED статуст шилжихэд (үүсгэгч баталгаажуулсны дараа)
-- хадгалагдах малын гүйлгээний түүх. Хэрэглэгч өөрийн худалдан авсан /
-- худалдсан малын статистик харахад ашиглана.

CREATE TABLE IF NOT EXISTS livestock_transactions (
  transaction_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id       UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  seller_id         UUID NOT NULL REFERENCES users(user_id),
  buyer_id          UUID NOT NULL REFERENCES users(user_id),
  livestock_type    VARCHAR(50) NOT NULL,
  count             INTEGER NOT NULL CHECK (count > 0),
  price_per_unit    DECIMAL(15, 2),
  total_amount      DECIMAL(15, 2),
  transaction_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lt_buyer
  ON livestock_transactions(buyer_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_lt_seller
  ON livestock_transactions(seller_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_lt_contract
  ON livestock_transactions(contract_id);
