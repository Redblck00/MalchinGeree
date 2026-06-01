const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const { cloudinary }        = require('./cloudinary')
const { safeErrorMessage }  = require('./errors')

// ── Зөвшөөрөгдсөн файлын өргөтгөлүүд ─────────────────
const ALLOWED = {
  image:    ['.jpg', '.jpeg', '.png', '.webp'],
  document: ['.pdf', '.docx', '.doc'],
  any:      ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.doc'],
}

// ── File filter factory ───────────────────────────────
const makeFilter = (allowed) => (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`Зөвшөөрөгдсөн файлын төрөл: ${allowed.join(', ')}`), false)
  }
}

// ── Upload instances ──────────────────────────────────

// Профайл зураг — Cloudinary дээр (production-д persistent)
// req.file.path = secure URL, req.file.filename = public_id
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'jpg'
    const uid = req.user?.user_id || 'anon'
    return {
      folder:        'econtract/profiles',
      resource_type: 'image',
      public_id:     `profile_${uid}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      format:        ext,
    }
  },
})

const profileUpload = multer({
  storage:    profileStorage,
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFilter(ALLOWED.image),
})

// ── Гэрээний хавсралт — Cloudinary дээр хадгална ──────
// PDF/JPG/PNG, 10MB. Cloudinary нь URL шууд буцаана.
// IMPORTANT: PDF-г 'image' resource_type-аар upload хийнэ — Cloudinary PDF-ийг
// image-ийн адил render хийдэг (browser inline preview, .pdf extension URL-д).
// DOC/DOCX зөвхөн 'raw'-аар л хадгалж болно.
// Хэрэв Cloudinary console дээр "Restricted media types"-д PDF/ZIP байвал
// тэр тохиргоог салгана уу: Console → Settings → Security.
const attachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const isDoc = ext === '.docx' || ext === '.doc'
    return {
      folder: 'econtract/attachments',
      // PDF = image (preview-able), DOC/DOCX = raw (binary), зураг = image
      resource_type: isDoc ? 'raw' : 'image',
      public_id:     `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      format:        ext.replace('.', ''),  // url-д extension хадгална
    }
  },
})

const attachmentUpload = multer({
  storage:    attachmentStorage,
  limits:     { fileSize: 10 * 1024 * 1024 },
  fileFilter: makeFilter(ALLOWED.any),
})

// ── Multer алдааг боловсруулах middleware ─────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Файл хэт том байна' })
    }
    return res.status(400).json({ message: 'Файл upload алдаа: ' + err.message })
  }
  if (err) {
    return res.status(400).json({ message: safeErrorMessage(err) })
  }
  next()
}

// ── Legacy local-disk файл устгах helper ──────────────
// Profile зураг одоо Cloudinary дээр; энэ нь зөвхөн хуучин DB row-той
// (Cloudinary биш local path) profile_image_url-ийг цэвэрлэхэд хэрэглэгдэнэ.
const deleteFile = (relativePath) => {
  if (!relativePath) return
  try {
    const full = path.join(process.cwd(), relativePath)
    if (fs.existsSync(full)) fs.unlinkSync(full)
  } catch (err) {
    console.error('Файл устгахад алдаа:', err.message)
  }
}

module.exports = {
  profileUpload,
  attachmentUpload,
  handleUploadError,
  deleteFile,
}
