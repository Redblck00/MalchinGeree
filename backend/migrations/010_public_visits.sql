-- Migration 010: public_visits — нэвтрээгүй зочдын хандалтын лог
-- Хэн ч (нэвтрээгүй) сайтад орох / public API хандах бүрд нэг мөр үүснэ.
-- session_hash = SHA-256(ip + user_agent) — давтагдашгүй зочин (unique visitor)
-- тооцоолоход хэрэглэгдэнэ (cookie бус, GDPR-нийцтэй pseudonym).

CREATE TABLE IF NOT EXISTS public_visits (
  visit_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path         VARCHAR(300) NOT NULL,
  method       VARCHAR(10)  NOT NULL DEFAULT 'GET',
  source       VARCHAR(20)  NOT NULL DEFAULT 'api',   -- 'api' | 'page'
  ip_address   INET,
  user_agent   VARCHAR(300),
  referer      VARCHAR(500),
  session_hash VARCHAR(64),
  visited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_date
  ON public_visits(visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_path_date
  ON public_visits(path, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_session
  ON public_visits(session_hash, visited_at DESC);
