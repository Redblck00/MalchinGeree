-- ══════════════════════════════════════════════════════════════════
-- 003_blockchain_onchain_anchor.sql
-- blockchain_ledger-д жинхэнэ EVM testnet (ж: Polygon Amoy) дээрх анкорын
-- мэдээллийг хадгалах багана нэмнэ.
--   onchain_tx_hash — testnet дээрх гүйлгээний жинхэнэ hash (0x...)
--   onchain_network — аль сүлжээ (amoy / sepolia / base-sepolia ...)
-- BLOCKCHAIN_MODE=testnet үед л дүүргэгдэнэ; simulation горимд NULL хэвээр.
-- Дотоод SHA-256 hash chain (block_hash, previous_hash) хэвээр ажиллана —
-- энэ нь зөвхөн нэмэлт давхар (on-chain) баталгаа.
-- IF NOT EXISTS — fresh DB дээр ч аюулгүй.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE blockchain_ledger
  ADD COLUMN IF NOT EXISTS onchain_tx_hash VARCHAR(80),
  ADD COLUMN IF NOT EXISTS onchain_network VARCHAR(40);

COMMIT;
