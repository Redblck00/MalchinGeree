const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const { cloudinary }        = require('./cloudinary')
const { safeErrorMessage }  = require('./errors')

// ── Хавтас үүсгэх helper ──────────────────────────────
const mkdirp = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ── Зөвшөөрөгдсөн файлын өргөтгөлүүд ─────────────────
const ALLOWED = {
  image:    ['.jpg', '.jpeg', '.png', '.webp'],
  document: ['.pdf', '.docx', '.doc'],
  any:      ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.doc'],
}

// ── Storage factory ───────────────────────────────────
const makeStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), 'uploads', folder)
      mkdirp(dir)
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase()
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      cb(null, name)
    },
  })

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

// Профайл зураг — зөвхөн зураг, 5MB
const profileUpload = multer({
  storage:  makeStorage('profiles'),
  limits:   { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFilter(ALLOWED.image),
})

// Гарын үсгийн зураг — зөвхөн зураг, 2MB
const signatureUpload = multer({
  storage:  makeStorage('signatures'),
  limits:   { fileSize: 2 * 1024 * 1024 },
  fileFilter: makeFilter(ALLOWED.image),
})

// Admin template файл — PDF/DOCX, 20MB
const templateUpload = multer({
  storage:  makeStorage('templates'),
  limits:   { fileSize: 20 * 1024 * 1024 },
  fileFilter: makeFilter(ALLOWED.document),
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

// ── Файл устгах helper ────────────────────────────────
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
  signatureUpload,
  templateUpload,
  attachmentUpload,
  handleUploadError,
  deleteFile,
}