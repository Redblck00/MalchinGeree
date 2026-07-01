-- ══════════════════════════════════════════════════════════════════
-- 004_refresh_tokens.sql
-- Rotating refresh token-ийн хадгалалт (гол төлөв mobile app-д зориулсан).
--   • token_hash — илгээсэн opaque token-ийн SHA-256 (түүхий утга ХАДГАЛАХГҮЙ).
--   • revoked_at — logout / rotation / reuse-detection үед тэмдэглэгдэнэ.
--   • expires_at — refresh TTL (default 30 хоног, REFRESH_TOKEN_TTL_DAYS-аар).
-- Access token (JWT) хэвээр богино хугацаатай; энэ хүснэгт нь урт хугацааны
-- сессийг дахин нэвтрэхгүйгээр сунгах боломж олгоно.
-- IF NOT EXISTS — fresh DB дээр ч аюулгүй.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,          -- SHA-256 hex
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,                        -- NULL = идэвхтэй
  user_agent  VARCHAR(300),
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Хэрэглэгчийн бүх токен (logout-all, цэвэрлэгээ, reuse detection)
CREATE INDEX IF NOT EXISTS idx_refresh_user
  ON refresh_tokens(user_id, created_at DESC);

-- Хугацаа дууссан токен цэвэрлэх cron-д туслах
CREATE INDEX IF NOT EXISTS idx_refresh_expires
  ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMIT;
