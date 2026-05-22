// ── Алдаа аюулгүй formatlamak ─────────────────────────
// Postgres драйверын throw хийдэг алдаанд хүснэгт, баганы нэр, constraint
// зэрэг мэдээлэл leak болдог. Эдгээрийг "Системийн алдаа гарлаа" хэлбэрээр
// хувиргаж frontend рүү буцаана.
//
// Хяналт: pg алдаа нь 5 тэмдэгтийн SQLSTATE код (`code`) болон ихэвчлэн
// `severity`, `table`, `constraint` поляр агуулна.

const isDbError = (err) =>
  !!err && typeof err === 'object' &&
  typeof err.code === 'string' &&
  /^[0-9A-Z]{5}$/.test(err.code)

// Хариу буцаах нийтлэг мессеж — DB-ийн дотоод бүтцийг задруулахгүй
const safeErrorMessage = (err, fallback = 'Алдаа гарлаа') => {
  if (!err) return fallback
  if (isDbError(err)) return 'Системийн алдаа гарлаа'
  // App логикийн алдаа (throw new Error('...')) шууд харуулж болно
  if (typeof err.message === 'string' && err.message.length > 0 && err.message.length < 200) {
    return err.message
  }
  return fallback
}

module.exports = { isDbError, safeErrorMessage }
