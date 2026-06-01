// ══════════════════════════════════════════════════════
// contractAttachment.controller.js
// Гэрээний хавсралт материал (Cloudinary дээр).
// contract.controller.js-аас салгасан — бизнес логик өөрчлөгдөөгүй.
// ══════════════════════════════════════════════════════

const repo                     = require('../repositories/contract.repository')
const { log }                  = require('../utils/logger')
const { safeErrorMessage }     = require('../utils/errors')
const { deleteFromCloudinary } = require('../utils/cloudinary')

// Cloudinary resource_type-ийг mimetype-аас тогтооно.
// PDF болон бүх зураг 'image' (Cloudinary PDF-ийг image-р render хийдэг).
// Зөвхөн DOC/DOCX 'raw' болно.
const resourceTypeFor = (mime) => {
  if (!mime) return 'raw'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'image'
  return 'raw'
}

// POST /api/contracts/:id/attachments
// multer-cloudinary middleware-ээр файл upload болсон → req.file
//   req.file.path     = Cloudinary бүтэн URL
//   req.file.filename = public_id
//   req.file.mimetype, size
const uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params
    if (!req.file) return res.status(400).json({ message: 'Файл оруулна уу' })

    // Эрх шалгах: тухайн гэрээний оролцогч эсэх + гарын үсэг зурагдаагүй (LOCK)
    const contract = await repo.findContractForAttachment(id, req.user.user_id)
    if (!contract) {
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
      return res.status(404).json({ message: 'Гэрээ олдсонгүй эсвэл эрх байхгүй' })
    }

    // Lock check — гарын үсэг зурагдсан бол хавсралт нэмж болохгүй
    if (await repo.hasSignature(id)) {
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээнд хавсралт нэмж болохгүй' })
    }

    // sort_order — одоо байгаа бүх хавсралтын дараа
    const nextOrder = await repo.nextAttachmentOrder(id)

    const attachment = await repo.insertAttachment({
      contractId: id,
      uploadedBy: req.user.user_id,
      fileName:   req.file.originalname,
      fileUrl:    req.file.path,
      publicId:   req.file.filename,   // Cloudinary public_id
      fileType:   req.file.mimetype,
      fileSize:   req.file.size,
      sortOrder:  nextOrder,
    })

    await log({
      user_id: req.user.user_id,
      action: 'CONTRACT_ATTACHMENT_ADD',
      entity_type: 'contract',
      entity_id: id,
      details: { file_name: req.file.originalname },
      req,
    })

    res.status(201).json({ data: attachment })
  } catch (err) {
    console.error('uploadAttachment:', err)
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename, resourceTypeFor(req.file.mimetype))
    }
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

// DELETE /api/contracts/:id/attachments/:attachmentId
// Зөвхөн uploaded_by + lock-той (гарын үсэг зурагдаагүй) үед
const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params

    // Lock check
    if (await repo.hasSignature(id)) {
      return res.status(400).json({ message: 'Гарын үсэг зурагдсан гэрээнээс хавсралт устгаж болохгүй' })
    }

    const att = await repo.findAttachmentById(attachmentId, id)
    if (!att) return res.status(404).json({ message: 'Хавсралт олдсонгүй' })
    if (att.uploaded_by !== req.user.user_id) {
      return res.status(403).json({ message: 'Зөвхөн оруулсан хүн өөрөө устгах эрхтэй' })
    }

    // Cloudinary-аас устгах
    await deleteFromCloudinary(att.public_id, resourceTypeFor(att.file_type))

    // DB-ээс устгах
    await repo.deleteAttachmentById(attachmentId)

    await log({
      user_id: req.user.user_id,
      action: 'CONTRACT_ATTACHMENT_DELETE',
      entity_type: 'contract',
      entity_id: id,
      req,
    })

    res.json({ message: 'Хавсралт устгагдлаа' })
  } catch (err) {
    console.error('deleteAttachment:', err)
    res.status(400).json({ message: safeErrorMessage(err) })
  }
}

module.exports = {
  uploadAttachment,
  deleteAttachment,
}
