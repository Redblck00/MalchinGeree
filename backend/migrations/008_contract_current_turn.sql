-- Migration 008: contracts.current_turn — "хэний ээлжтэй вэ"
--
-- Negotiation урсгал:
--   • DRAFT          → current_turn = 'CREATOR' (үүсгэгч ноорог үүсгэж байна)
--   • SENT эхэлж     → current_turn = 'COUNTERPARTY' (хариу хүлээж байна)
--   • Counterparty засаад буцаавал → current_turn = 'CREATOR'
--   • Creator засаад буцаавал      → current_turn = 'COUNTERPARTY'
--   • Гарын үсэг зурвал            → current_turn = (нөгөө тал)
--
-- Анхаар: NULL зөвшөөрнө — гэрээ COMPLETED/CANCELLED болсон үед хэрэггүй

BEGIN;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS current_turn participant_role_enum DEFAULT 'CREATOR';

-- Одоо байгаа гэрээнүүдэд статусаас хамаарч анхны утга тавих
UPDATE contracts SET current_turn = 'CREATOR'      WHERE status = 'DRAFT';
UPDATE contracts SET current_turn = 'COUNTERPARTY' WHERE status = 'SENT';
UPDATE contracts SET current_turn = NULL
  WHERE status IN ('COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED');

COMMIT;
