-- Migration 009: user_rating_summary-г энгийн VIEW болгох
-- Шалтгаан: MATERIALIZED VIEW нь өгөгдөл шинэчлэхэд REFRESH хийх шаардлагатай.
-- Дипломын жижиг хэмжээний өгөгдөлд VIEW нь шууд тооцоологдох тул илүү
-- тохиромжтой (real-time average rating).

-- Хуучин materialized view-г устгах
DROP MATERIALIZED VIEW IF EXISTS user_rating_summary CASCADE;

-- Шинэ regular VIEW
CREATE OR REPLACE VIEW user_rating_summary AS
SELECT
  rated_user_id                          AS user_id,
  ROUND(AVG(rating)::numeric, 2)::DECIMAL(3, 2) AS rating_avg,
  COUNT(*)::INTEGER                      AS rating_count
FROM user_ratings
GROUP BY rated_user_id;
