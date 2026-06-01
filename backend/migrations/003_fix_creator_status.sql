-- Migration 003: CREATOR-ийн status дутуу 'SIGNED' болсныг засна
-- Өмнө createContract нь creator-г шууд status='SIGNED' гэж хадгалдаг байсан
-- ч signature_blob контрактэд байхгүй байсан тул UI зөв ажиллахгүй байсан.
--
-- Энэ migration:
--   - CREATOR participant-ууд дотроос signature_blob ОРООГҮЙ
--     харин status='SIGNED' болсныг → 'VIEWED' болгож буцаана.
--   - Эдгээр гэрээнүүдийн creator одоо signature товчийг дарж жинхэнэ
--     гарын үсэг оруулах боломжтой болно.

UPDATE contract_participants cp
SET status = 'VIEWED'
WHERE cp.role = 'CREATOR'
  AND cp.status = 'SIGNED'
  AND NOT EXISTS (
    SELECT 1 FROM contract_signatures cs
    WHERE cs.participant_id = cp.participant_id
  );
