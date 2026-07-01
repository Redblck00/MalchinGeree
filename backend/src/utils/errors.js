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

// ── AppError — HTTP статустай "operational" (хүлээгдсэн) алдаа ──────────
// Бизнес логик энэ алдааг throw хийхэд controller-ийн catch түүний
// statusCode-оор хариулна. statusCode байхгүй (гэнэтийн) алдаа → 500.
//
// Жишээ:
//   if (!contract) throw AppError.notFound('Гэрээ олдсонгүй')      // → 404
//   if (existing)  throw AppError.conflict('Аль хэдийн бүртгэлтэй')  // → 409
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.isOperational = true  // хүлээгдсэн — мессежийг клиентэд харуулж болно
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError)
  }

  static badRequest  (m = 'Буруу хүсэлт')          { return new AppError(m, 400) }
  static unauthorized(m = 'Нэвтрэх шаардлагатай')  { return new AppError(m, 401) }
  static forbidden   (m = 'Хандах эрхгүй')          { return new AppError(m, 403) }
  static notFound    (m = 'Олдсонгүй')              { return new AppError(m, 404) }
  static conflict    (m = 'Давхцаж байна')          { return new AppError(m, 409) }
}

// Хариу буцаах нийтлэг мессеж — DB-ийн дотоод бүтцийг задруулахгүй
const safeErrorMessage = (err, fallback = 'Алдаа гарлаа') => {
  if (!err) return fallback
  // AppError (operational) — зориудаар клиентэд зориулсан мессеж
  if (err.isOperational && typeof err.message === 'string') return err.message
  if (isDbError(err)) return 'Системийн алдаа гарлаа'
  // App логикийн алдаа (throw new Error('...')) шууд харуулж болно
  if (typeof err.message === 'string' && err.message.length > 0 && err.message.length < 200) {
    return err.message
  }
  return fallback
}

module.exports = { isDbError, safeErrorMessage, AppError }
