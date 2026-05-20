Auth:
  POST /api/auth/register       ← бүртгэл → OTP
  POST /api/auth/verify-otp     ← OTP → token
  POST /api/auth/login          ← нэвтрэх → token
  POST /api/auth/resend-otp     ← OTP дахин

Admin (JWT + ADMIN эрх):
  GET    /api/admin/stats
  GET    /api/admin/templates
  POST   /api/admin/templates   ← template_content + schema_json
  PATCH  /api/admin/templates/:id
  DELETE /api/admin/templates/:id
  GET    /api/admin/users
  PATCH  /api/admin/users/:id/status
  GET    /api/admin/contracts
  PATCH  /api/admin/contracts/:id/status
  GET    /api/admin/logs

Contract (JWT):
  GET    /api/contracts/templates     ← schema_json авах
  GET    /api/contracts/templates/:id
  POST   /api/contracts               ← үүсгэх → render
  GET    /api/contracts               ← миний гэрээнүүд
  GET    /api/contracts/:id           ← rendered_content
  PATCH  /api/contracts/:id           ← засах → дахин render
  POST   /api/contracts/:id/send      ← нөгөө тал → email
  POST   /api/contracts/:id/sign      ← гарын үсэг → trigger
  POST   /api/contracts/:id/confirm   ← COMPLETED → trigger
  POST   /api/contracts/:id/cancel