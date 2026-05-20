// authMiddleware-ийн дараа ашиглана
// router.use(auth); router.use(role('ADMIN'))

const roleMiddleware = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Нэвтрэх шаардлагатай' })
  }
  if (!roles.includes(req.user.user_type)) {
    return res.status(403).json({ message: 'Энэ үйлдлийг хийх эрх байхгүй' })
  }
  next()
}

module.exports = roleMiddleware