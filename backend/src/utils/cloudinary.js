const { v2: cloudinary } = require('cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message)
  }
}

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
