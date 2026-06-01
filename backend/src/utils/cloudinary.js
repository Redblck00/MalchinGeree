const { v2: cloudinary } = require('cloudinary')

// ── Cloudinary тохиргоо ──────────────────────────────
// .env-д CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// тохируулсан байх ёстой.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

// Файл устгах helper — public_id-ээр
// resource_type: image (default), raw (PDF/DOCX), video
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message)
  }
}

// Cloudinary secure URL → public_id (folder/name, extension-гүй)
const publicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null
  const marker = '/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  let rest = url.slice(idx + marker.length).split('?')[0]
  rest = rest.replace(/^v\d+\//, '')
  const lastDot = rest.lastIndexOf('.')
  if (lastDot > rest.lastIndexOf('/')) rest = rest.slice(0, lastDot)
  return rest || null
}

module.exports = { cloudinary, deleteFromCloudinary, publicIdFromUrl }
