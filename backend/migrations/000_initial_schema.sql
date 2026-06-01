-- ══════════════════════════════════════════════════════════════════
-- 000 — Цахим гэрээний системийн өгөгдлийн сангийн анхны схем
-- PostgreSQL 14+
-- Бүх migration (001-010)-ийн төгсгөлийн төлвийг агуулсан цэвэр CREATE-only схем.
-- Fresh DB-д л ажиллах ёстой; migrate.js нь _migrations-д бүртгэж дахин гүйцэтгэхгүй.
-- ══════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ══════════════════════════════════════════════════════════════════
-- 1. ENUM ТӨРЛҮҮД
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE user_type_enum AS ENUM (
    'USER', 'ADMIN', 'SUPPORT'
);

CREATE TYPE user_status_enum AS ENUM (
    'PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'
);

CREATE TYPE otp_channel_enum AS ENUM (
    'EMAIL', 'SMS'
);

CREATE TYPE signature_type_enum AS ENUM (
    'DRAW', 'UPLOAD', 'TYPE'
);

CREATE TYPE contract_status_enum AS ENUM (
    'DRAFT',              -- үүсгэж байна
    'SENT',               -- илгээгдсэн, нөгөө тал хүлээж байна
    'PARTIALLY_SIGNED',   -- зарим оролцогч зурсан
    'FULLY_SIGNED',       -- бүгд зурсан, үүсгэгч баталгаажуулах ёстой
    'COMPLETED',          -- үүсгэгч баталгаажуулсан
    'CLOSED',             -- үүсгэгч хааж дуусгасан (rating нээгдэнэ)
    'DECLINED',           -- нөгөө тал татгалзсан
    'CANCELLED',          -- үүсгэгч цуцалсан
    'EXPIRED'             -- хугацаа дууссан
);

CREATE TYPE participant_role_enum AS ENUM (
    'CREATOR', 'COUNTERPARTY', 'WITNESS'
);

CREATE TYPE participant_status_enum AS ENUM (
    'PENDING_INVITE',
    'INVITED',
    'LINK_OPENED',
    'REGISTERED',
    'VIEWED',
    'SIGNED',
    'DECLINED'
);

CREATE TYPE notification_channel_enum AS ENUM (
    'IN_APP', 'EMAIL', 'SMS'
);

CREATE TYPE delivery_status_enum AS ENUM (
    'PENDING', 'SENT', 'DELIVERED', 'FAILED'
);

CREATE TYPE queue_action_enum AS ENUM (
    'CREATE_CONTRACT', 'SIGN_CONTRACT', 'UPDATE_PROFILE', 'OTHER'
);

CREATE TYPE token_attempt_result_enum AS ENUM (
    'SUCCESS', 'EXPIRED', 'REVOKED', 'NOT_FOUND',
    'EMAIL_MISMATCH', 'RATE_LIMITED'
);


-- ══════════════════════════════════════════════════════════════════
-- 2. ТУСЛАХ ФУНКЦУУД
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION default_invitation_expiry()
RETURNS TIMESTAMPTZ AS $$
    SELECT NOW() + INTERVAL '7 days';
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION default_signing_session_expiry()
RETURNS TIMESTAMPTZ AS $$
    SELECT NOW() + INTERVAL '15 minutes';
$$ LANGUAGE SQL IMMUTABLE;


-- ══════════════════════════════════════════════════════════════════
-- 3. ХЭРЭГЛЭГЧИЙН ХҮСНЭГТҮҮД
-- ══════════════════════════════════════════════════════════════════

-- ── 3.1 Хэрэглэгч ─────────────────────────────────────────────────
CREATE TABLE users (
    user_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(150) UNIQUE,
    phone             VARCHAR(20)  UNIQUE,
    address           VARCHAR(300),
    profile_image_url VARCHAR(500),
    password_hash     VARCHAR(255) NOT NULL,
    user_type         user_type_enum   NOT NULL DEFAULT 'USER',
    status            user_status_enum NOT NULL DEFAULT 'PENDING',
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_users_email  ON users(LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone  ON users(phone)        WHERE phone IS NOT NULL;
CREATE INDEX idx_users_status ON users(status)       WHERE status = 'ACTIVE';


-- ── 3.2 OTP (бүртгэл, нэвтрэлт) ───────────────────────────────────
-- pending_data: бүртгэлийн мэдээллийг OTP баталгаажихаас өмнө түр хадгална
CREATE TABLE otps (
    otp_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient     VARCHAR(150) NOT NULL,         -- email эсвэл phone
    channel       otp_channel_enum NOT NULL,
    code_hash     VARCHAR(255) NOT NULL,         -- SHA-256(code)
    pending_data  JSONB,                          -- бүртгэлийн draft (#001)
    is_used       BOOLEAN NOT NULL DEFAULT false,
    attempts      SMALLINT NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_otp_attempts CHECK (attempts <= 5)
);

CREATE INDEX idx_otps_recipient_active
    ON otps(recipient, is_used, expires_at)
    WHERE is_used = false;


-- ── 3.3 Хэрэглэгчийн гарын үсэг (хадгалсан загвар) ────────────────
CREATE TABLE user_signatures (
    user_signature_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    signature_blob    TEXT NOT NULL,
    signature_type    signature_type_enum NOT NULL DEFAULT 'DRAW',
    is_default        BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_signatures_user ON user_signatures(user_id);
CREATE UNIQUE INDEX uq_user_default_signature
    ON user_signatures(user_id) WHERE is_default = true;


-- ══════════════════════════════════════════════════════════════════
-- 4. ГЭРЭЭНИЙ ХҮСНЭГТҮҮД
-- ══════════════════════════════════════════════════════════════════

-- ── 4.1 Гэрээний загвар ───────────────────────────────────────────
CREATE TABLE contract_templates (
    template_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(200) NOT NULL,
    description      TEXT,
    template_content TEXT NOT NULL,
    schema_json      JSONB NOT NULL,
    file_url         VARCHAR(500),
    is_standard      BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_by       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_creator  ON contract_templates(created_by);
CREATE INDEX idx_templates_standard ON contract_templates(is_standard) WHERE is_standard = true;
CREATE INDEX idx_templates_active   ON contract_templates(is_active)   WHERE is_active = true;


-- ── 4.2 Гэрээний дугаарын sequence ────────────────────────────────
CREATE SEQUENCE contract_seq START WITH 1 INCREMENT BY 1;


-- ── 4.3 Гэрээ ─────────────────────────────────────────────────────
-- creator_role: үүсгэгч худалдагч уу, худалдан авагч уу (#002)
-- current_turn: одоо хэний ээлжтэй вэ (#008b)
-- closed_at/close_reason: CLOSED статуст шилжсэн (#008a)
CREATE TABLE contracts (
    contract_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number  VARCHAR(20) UNIQUE,
    template_id      UUID NOT NULL REFERENCES contract_templates(template_id),
    creator_id       UUID NOT NULL REFERENCES users(user_id),
    creator_role     VARCHAR(10) NOT NULL DEFAULT 'seller',
    title            VARCHAR(300),
    filled_data_json JSONB NOT NULL DEFAULT '{}',
    status           contract_status_enum NOT NULL DEFAULT 'DRAFT',
    current_turn     participant_role_enum DEFAULT 'CREATOR',
    expires_at       TIMESTAMPTZ,
    sent_at          TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    closed_at        TIMESTAMPTZ,
    close_reason     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_creator_role CHECK (creator_role IN ('seller', 'buyer'))
);

CREATE INDEX idx_contracts_creator  ON contracts(creator_id, status);
CREATE INDEX idx_contracts_status   ON contracts(status, created_at DESC);
CREATE INDEX idx_contracts_template ON contracts(template_id);

-- Гэрээний дугаар автоматаар үүсгэх trigger
CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.contract_number IS NULL THEN
        NEW.contract_number := 'CNT-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                               LPAD(nextval('contract_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_contract
    BEFORE INSERT ON contracts
    FOR EACH ROW EXECUTE FUNCTION set_contract_number();


-- ── 4.4 Гэрээний хувилбар (snapshot — хууль зүйн ач холбогдол) ────
-- Нэг гэрээ → нэг version (#007). qr_code_url TEXT (base64 data URL ~2KB+, #006).
CREATE TABLE contract_versions (
    version_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id       UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    rendered_content  TEXT NOT NULL,
    rendered_hash     VARCHAR(64) NOT NULL,    -- SHA-256
    pdf_url           VARCHAR(500),
    qr_code_url       TEXT,
    blockchain_hash   VARCHAR(200),
    blockchain_at     TIMESTAMPTZ,
    blockchain_tx_id  VARCHAR(200),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_one_version UNIQUE (contract_id)
);

CREATE INDEX idx_contract_versions_hash ON contract_versions(rendered_hash);


-- ── 4.5 Гэрээний оролцогч ─────────────────────────────────────────
CREATE TABLE contract_participants (
    participant_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id      UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(user_id) ON DELETE SET NULL,
    role             participant_role_enum NOT NULL,
    invite_email     VARCHAR(150),
    invite_phone     VARCHAR(20),
    status           participant_status_enum NOT NULL DEFAULT 'PENDING_INVITE',
    invited_at       TIMESTAMPTZ,
    link_opened_at   TIMESTAMPTZ,
    viewed_at        TIMESTAMPTZ,
    signed_at        TIMESTAMPTZ,
    declined_at      TIMESTAMPTZ,
    declined_reason  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_user_role UNIQUE (contract_id, user_id, role),
    CONSTRAINT chk_participant_contact
        CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL OR invite_phone IS NOT NULL)
);

CREATE INDEX idx_participants_contract
    ON contract_participants(contract_id);

-- "Ирсэн гэрээ" жагсаалтын гол индекс
CREATE INDEX idx_participants_inbox
    ON contract_participants(user_id, status, created_at DESC)
    WHERE user_id IS NOT NULL;

-- Бүртгэлгүй хүний email-аар хайх (login-ы дараа холбохын тулд)
CREATE INDEX idx_participants_pending_email
    ON contract_participants(LOWER(invite_email))
    WHERE user_id IS NULL AND invite_email IS NOT NULL;

-- NULL user_id-тэй мөрүүдэд email/phone дээр давхардал хориглох
CREATE UNIQUE INDEX uq_contract_invite_email
    ON contract_participants(contract_id, LOWER(invite_email), role)
    WHERE user_id IS NULL AND invite_email IS NOT NULL;


-- ── 4.6 Гэрээний гарын үсэг ───────────────────────────────────────
CREATE TABLE contract_signatures (
    signature_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id       UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    participant_id    UUID NOT NULL REFERENCES contract_participants(participant_id) ON DELETE CASCADE,
    version_id        UUID NOT NULL REFERENCES contract_versions(version_id),
    placeholder_key   VARCHAR(50) NOT NULL,
    signature_blob    TEXT NOT NULL,
    signed_ip         INET,
    signed_user_agent VARCHAR(300),
    signed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, participant_id, placeholder_key)
);

CREATE INDEX idx_signatures_contract    ON contract_signatures(contract_id);
CREATE INDEX idx_signatures_participant ON contract_signatures(participant_id);


-- ── 4.7 Гэрээний төлвийн түүх (audit) ─────────────────────────────
CREATE TABLE contract_status_history (
    history_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id  UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    from_status  contract_status_enum,
    to_status    contract_status_enum NOT NULL,
    changed_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_contract ON contract_status_history(contract_id, created_at);


-- ── 4.8 Үүсгэгчийн баталгаажуулалт ────────────────────────────────
CREATE TABLE contract_confirmations (
    confirmation_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id          UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    confirmed_by         UUID NOT NULL REFERENCES users(user_id),
    version_id           UUID NOT NULL REFERENCES contract_versions(version_id),
    confirmed_ip         INET,
    confirmed_user_agent VARCHAR(300),
    confirmed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

CREATE INDEX idx_confirmations_user ON contract_confirmations(confirmed_by);


-- ── 4.9 Гэрээний засварын аудит лог (JSON diff + negotiation note) ─
-- note: /return endpoint-ээр negotiate хийхэд "яагаад өөрчилснөө" тайлбарлана (#008)
CREATE TABLE contract_edit_log (
    edit_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id    UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    edited_by      UUID NOT NULL REFERENCES users(user_id),
    changed_fields JSONB NOT NULL,
    -- Жишээ: {
    --   "seller.phone":         { "old": "99...", "new": "88..." },
    --   "payment.total_amount": { "old": 1000000, "new": 1200000 }
    -- }
    note           TEXT,
    edited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_edit_log_contract
    ON contract_edit_log(contract_id, edited_at DESC);


-- ── 4.10 Гэрээний хавсралт файл (#009a) ──────────────────────────
-- file_url: Cloudinary бүтэн URL; public_id Cloudinary-аас устгахад хэрэгтэй
CREATE TABLE contract_attachments (
    attachment_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(user_id),
    file_name       VARCHAR(255) NOT NULL,
    file_url        VARCHAR(500) NOT NULL,
    public_id       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50)  NOT NULL,    -- mime type
    file_size       INTEGER      NOT NULL,    -- bytes
    sort_order      SMALLINT     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_contract ON contract_attachments(contract_id, sort_order);
CREATE INDEX idx_attachments_uploader ON contract_attachments(uploaded_by);


-- ══════════════════════════════════════════════════════════════════
-- 5. URILGYN TOKEN ХҮСНЭГТҮҮД
-- ══════════════════════════════════════════════════════════════════

-- ── 5.1 Invitation token (7 хоногийн хугацаатай) ─────────────────
CREATE TABLE participant_invitations (
    invitation_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id   UUID NOT NULL REFERENCES contract_participants(participant_id) ON DELETE CASCADE,
    token_hash       VARCHAR(64) NOT NULL UNIQUE,
    expires_at       TIMESTAMPTZ NOT NULL DEFAULT default_invitation_expiry(),
    consumed_at      TIMESTAMPTZ,
    last_used_at     TIMESTAMPTZ,
    is_revoked       BOOLEAN NOT NULL DEFAULT false,
    revoked_reason   VARCHAR(50),
    sent_to_email    VARCHAR(150),
    sent_to_phone    VARCHAR(20),
    first_ip         INET,
    first_user_agent VARCHAR(300),
    use_count        SMALLINT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invitation_use_count CHECK (use_count <= 50)
);

CREATE INDEX idx_invitations_participant ON participant_invitations(participant_id);
CREATE INDEX idx_invitations_active
    ON participant_invitations(token_hash)
    WHERE is_revoked = false;
CREATE INDEX idx_invitations_expired
    ON participant_invitations(expires_at)
    WHERE is_revoked = false;


-- ── 5.2 Signing session token (15 минутын хугацаатай) ────────────
CREATE TABLE signing_sessions (
    session_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id     UUID NOT NULL REFERENCES contract_participants(participant_id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(user_id),
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ NOT NULL DEFAULT default_signing_session_expiry(),
    consumed_at        TIMESTAMPTZ,
    ip_address         INET NOT NULL,
    user_agent         VARCHAR(300),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signing_sessions_active
    ON signing_sessions(session_token_hash)
    WHERE consumed_at IS NULL;
CREATE INDEX idx_signing_sessions_user ON signing_sessions(user_id, created_at DESC);


-- ── 5.3 Token-ы оролдлогын лог (audit + rate limiting) ───────────
CREATE TABLE token_access_log (
    log_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invitation_id      UUID REFERENCES participant_invitations(invitation_id) ON DELETE SET NULL,
    token_hash_partial VARCHAR(16),
    result             token_attempt_result_enum NOT NULL,
    ip_address         INET,
    user_agent         VARCHAR(300),
    accessed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_log_invitation ON token_access_log(invitation_id, accessed_at DESC);
CREATE INDEX idx_token_log_ip_recent  ON token_access_log(ip_address, accessed_at DESC);


-- ── 5.4 Blockchain ledger (in-house SHA-256 chain, #005) ─────────
CREATE TABLE blockchain_ledger (
    block_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_number  INTEGER NOT NULL UNIQUE,
    previous_hash VARCHAR(64) NOT NULL,
    contract_id   UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    contract_hash VARCHAR(64) NOT NULL,    -- rendered_hash-аас
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    block_hash    VARCHAR(64) NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bc_contract     ON blockchain_ledger(contract_id);
CREATE INDEX idx_bc_block_number ON blockchain_ledger(block_number DESC);


-- ══════════════════════════════════════════════════════════════════
-- 6. МЭДЭГДЭЛ, ҮНЭЛГЭЭ, OFFLINE
-- ══════════════════════════════════════════════════════════════════

-- ── 6.1 Мэдэгдэл ──────────────────────────────────────────────────
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(user_id) ON DELETE CASCADE,
    contract_id     UUID REFERENCES contracts(contract_id) ON DELETE SET NULL,
    channel         notification_channel_enum NOT NULL DEFAULT 'IN_APP',
    recipient       VARCHAR(150),
    title           VARCHAR(200),
    message         TEXT,
    delivery_status delivery_status_enum NOT NULL DEFAULT 'PENDING',
    delivered_at    TIMESTAMPTZ,
    error_message   TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_target
        CHECK (user_id IS NOT NULL OR recipient IS NOT NULL)
);

CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC)
    WHERE is_read = false;
CREATE INDEX idx_notifications_pending
    ON notifications(delivery_status, created_at)
    WHERE delivery_status = 'PENDING';


-- ── 6.2 Хэрэглэгчийн үнэлгээ ──────────────────────────────────────
CREATE TABLE user_ratings (
    rating_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id   UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    rater_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, rater_id, rated_user_id),
    CONSTRAINT chk_rating_not_self CHECK (rater_id <> rated_user_id)
);

CREATE INDEX idx_ratings_rated_user ON user_ratings(rated_user_id);
CREATE INDEX idx_ratings_rater      ON user_ratings(rater_id);


-- Дундаж үнэлгээний regular VIEW (real-time, MATERIALIZED биш — #009b)
CREATE OR REPLACE VIEW user_rating_summary AS
SELECT
    rated_user_id                                AS user_id,
    ROUND(AVG(rating)::numeric, 2)::DECIMAL(3,2) AS rating_avg,
    COUNT(*)::INTEGER                            AS rating_count
FROM user_ratings
GROUP BY rated_user_id;


-- ── 6.3 Offline queue ─────────────────────────────────────────────
CREATE TABLE offline_queue (
    queue_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES users(user_id) ON DELETE CASCADE,
    action_type   queue_action_enum NOT NULL,
    payload_json  JSONB NOT NULL,
    sync_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    contract_id   UUID REFERENCES contracts(contract_id) ON DELETE SET NULL,
    retry_count   SMALLINT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at     TIMESTAMPTZ
);

CREATE INDEX idx_queue_pending
    ON offline_queue(sync_status, created_at)
    WHERE sync_status = 'PENDING';
CREATE INDEX idx_queue_user ON offline_queue(user_id, created_at DESC);


-- ── 6.4 Системийн лог ─────────────────────────────────────────────
CREATE TABLE system_logs (
    log_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    details     JSONB,
    ip_address  INET,
    user_agent  VARCHAR(300),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_user   ON system_logs(user_id, created_at DESC);
CREATE INDEX idx_logs_entity ON system_logs(entity_type, entity_id);
CREATE INDEX idx_logs_action ON system_logs(action, created_at DESC);


-- ── 6.5 Малын гүйлгээний түүх (#004) ─────────────────────────────
-- Гэрээ COMPLETED статуст шилжихэд (үүсгэгч баталгаажуулсны дараа)
-- хадгалагдах гүйлгээ. Хэрэглэгч өөрийн худалдсан/худалдан авсан малын статистик харахад.
CREATE TABLE livestock_transactions (
    transaction_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id      UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    seller_id        UUID NOT NULL REFERENCES users(user_id),
    buyer_id         UUID NOT NULL REFERENCES users(user_id),
    livestock_type   VARCHAR(50) NOT NULL,
    count            INTEGER NOT NULL CHECK (count > 0),
    price_per_unit   DECIMAL(15, 2),
    total_amount     DECIMAL(15, 2),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lt_buyer    ON livestock_transactions(buyer_id, transaction_date DESC);
CREATE INDEX idx_lt_seller   ON livestock_transactions(seller_id, transaction_date DESC);
CREATE INDEX idx_lt_contract ON livestock_transactions(contract_id);


-- ── 6.6 Нэвтрээгүй зочдын хандалтын лог (#010) ───────────────────
-- session_hash = SHA-256(ip + user_agent) — unique visitor тооцоолоход (cookie-гүй).
CREATE TABLE public_visits (
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

CREATE INDEX idx_visits_date      ON public_visits(visited_at DESC);
CREATE INDEX idx_visits_path_date ON public_visits(path, visited_at DESC);
CREATE INDEX idx_visits_session   ON public_visits(session_hash, visited_at DESC);


-- ══════════════════════════════════════════════════════════════════
-- 7. БИЗНЕС ЛОГИКИЙН TRIGGER-УУД
-- ══════════════════════════════════════════════════════════════════

-- ── 7.1 Гарын үсэг зурахад participant.status шинэчлэх ───────────
CREATE OR REPLACE FUNCTION on_signature_added()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contract_participants
       SET status    = 'SIGNED',
           signed_at = NOW()
     WHERE participant_id = NEW.participant_id;

    -- Хэрэглэгчийн идэвхтэй invitation-уудыг хаах
    UPDATE participant_invitations
       SET is_revoked     = true,
           revoked_reason = 'SIGNED'
     WHERE participant_id = NEW.participant_id
       AND is_revoked     = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_signature_insert
    AFTER INSERT ON contract_signatures
    FOR EACH ROW EXECUTE FUNCTION on_signature_added();


-- ── 7.2 Бүгд зурсан эсэхийг шалгаж contract.status шинэчлэх ──────
-- CREATOR + COUNTERPARTY хоёрыг тоох (WITNESS-ийг хасна, #009-fix)
-- Counterparty дангаар зурахад FULLY_SIGNED болохгүй — CREATOR ч зурсан байх ёстой.
CREATE OR REPLACE FUNCTION recalculate_contract_status()
RETURNS TRIGGER AS $$
DECLARE
    total_count  INTEGER;
    signed_count INTEGER;
    new_status   contract_status_enum;
    old_status   contract_status_enum;
BEGIN
    SELECT COUNT(*) FILTER (WHERE role IN ('CREATOR', 'COUNTERPARTY')),
           COUNT(*) FILTER (WHERE role IN ('CREATOR', 'COUNTERPARTY') AND status = 'SIGNED')
      INTO total_count, signed_count
      FROM contract_participants
     WHERE contract_id = NEW.contract_id;

    SELECT status INTO old_status
      FROM contracts
     WHERE contract_id = NEW.contract_id;

    -- COUNTERPARTY байхгүй (зөвхөн CREATOR байгаа) бол FULLY_SIGNED болгохгүй
    IF total_count < 2 THEN
        RETURN NEW;
    ELSIF signed_count = 0 THEN
        new_status := old_status;
    ELSIF signed_count < total_count THEN
        new_status := 'PARTIALLY_SIGNED';
    ELSE
        new_status := 'FULLY_SIGNED';
    END IF;

    IF new_status <> old_status THEN
        UPDATE contracts
           SET status     = new_status,
               updated_at = NOW()
         WHERE contract_id = NEW.contract_id;

        INSERT INTO contract_status_history(contract_id, from_status, to_status, reason)
        VALUES (NEW.contract_id, old_status, new_status, 'auto: signature update');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_participant_signed
    AFTER UPDATE OF status ON contract_participants
    FOR EACH ROW
    WHEN (NEW.status = 'SIGNED' AND OLD.status <> 'SIGNED')
    EXECUTE FUNCTION recalculate_contract_status();


-- ── 7.3 Үүсгэгч баталгаажуулахад COMPLETED руу шилжүүлэх ─────────
CREATE OR REPLACE FUNCTION on_contract_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contracts
       SET status       = 'COMPLETED',
           completed_at = NOW(),
           updated_at   = NOW()
     WHERE contract_id = NEW.contract_id
       AND status      = 'FULLY_SIGNED';

    INSERT INTO contract_status_history(contract_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.contract_id, 'FULLY_SIGNED', 'COMPLETED', NEW.confirmed_by, 'creator confirmed');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_confirmation_insert
    AFTER INSERT ON contract_confirmations
    FOR EACH ROW EXECUTE FUNCTION on_contract_confirmed();


-- ── 7.4 updated_at автомат шинэчлэх ──────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_templates_updated_at
    BEFORE UPDATE ON contract_templates
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
