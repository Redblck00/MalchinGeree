// ── Имэйл илгээх — Brevo HTTP API (порт 443) ──────────────
// Render free instance гадагшаа SMTP порт (25/465/587) хаадаг тул
// nodemailer/SMTP ажиллахгүй. Иймд HTTPS дээр суурилсан Brevo API ашиглана.
//   Sender (EMAIL_FROM) нь Brevo дээр баталгаажсан байх ёстой.
//   https://app.brevo.com → Senders & IP → шинэ sender нэмж баталгаажуул.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const BREVO_API_KEY = process.env.BREVO_API_KEY
const FROM_EMAIL    = process.env.EMAIL_FROM || process.env.EMAIL_USER
const FROM_NAME     = 'Цахим Гэрээ'

// Дотоод helper — нэг имэйл илгээнэ. SMTP-гүй, HTTP POST.
const sendMail = async ({ to, subject, html }) => {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY тохируулагдаагүй байна')
  if (!FROM_EMAIL)    throw new Error('EMAIL_FROM (sender) тохируулагдаагүй байна')

  // 15 секундын дотор хариу ирэхгүй бол таслана (хэт удаан өлгөлдөхөөс сэргийлэх)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Имэйл илгээхэд алдаа (${res.status}): ${errText}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

// OTP код илгээх
const sendOtpEmail = async (email, code) => {
  await sendMail({
    to:      email,
    subject: 'Баталгаажуулах OTP код',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px">
        <h2 style="color:#1e1b4b">Таны баталгаажуулах код</h2>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                    color:#1e1b4b;padding:16px;background:#f5f5ff;
                    border-radius:8px;text-align:center">${code}</div>
        <p style="color:#666;margin-top:16px">
          Энэ код <strong>${process.env.OTP_EXPIRES_MIN || 5} минут</strong> хүчинтэй.
        </p>
      </div>
    `,
  })
}

// Гэрээний урилга илгээх — contract.controller /send route
const sendInviteEmail = async ({ to, contractTitle, inviteUrl, senderName, customSubject }) => {
  const subject = (customSubject || '').trim()
    || `${senderName} таныг гэрээнд урьж байна`
  await sendMail({
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <h2 style="color:#1e1b4b">Гэрээний урилга</h2>
        <p>
          <strong>${senderName}</strong> таныг
          "<strong>${contractTitle}</strong>" гэрээнд
          гарын үсэг зурахыг хүсэж байна.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:12px 24px;background:#1e1b4b;
                  color:white;text-decoration:none;border-radius:8px;margin-top:16px">
          Гэрээг харах
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Линк 7 хоног хүчинтэй.
        </p>
      </div>
    `,
  })
}

// Гэрээний үйл явдлын мэдэгдэл — өөрчлөлт хийсэн / гарын үсэг зурсан
//   eventType: 'EDITED' | 'SIGNED' | 'RETURNED'
const sendContractEventEmail = async ({ to, contractTitle, actorName, eventType, contractUrl, note }) => {
  const subjects = {
    EDITED:   `"${contractTitle}" гэрээнд өөрчлөлт орлоо`,
    SIGNED:   `"${contractTitle}" гэрээнд гарын үсэг зурлаа`,
    RETURNED: `"${contractTitle}" гэрээг танд буцаалаа`,
  }
  const headlines = {
    EDITED:   'Гэрээнд өөрчлөлт орлоо',
    SIGNED:   'Гэрээнд гарын үсэг зурлаа',
    RETURNED: 'Гэрээг танд буцаалаа',
  }
  const descriptions = {
    EDITED:   `<strong>${actorName}</strong> "<strong>${contractTitle}</strong>" гэрээнд өөрчлөлт оруулсан тул нэгэнт хянаж үзнэ үү.`,
    SIGNED:   `<strong>${actorName}</strong> "<strong>${contractTitle}</strong>" гэрээнд гарын үсэг зурлаа.`,
    RETURNED: `<strong>${actorName}</strong> "<strong>${contractTitle}</strong>" гэрээг засаад танд буцаалаа.`,
  }

  const safeNote = note
    ? String(note)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : null
  const noteHtml = safeNote ? `
        <div style="margin-top:16px;padding:12px 16px;background:#f5f3ff;
                    border-left:3px solid #6d28d9;border-radius:6px">
          <p style="margin:0 0 4px 0;color:#6d28d9;font-size:12px;font-weight:600">Тайлбар</p>
          <p style="margin:0;color:#1e1b4b;font-size:14px;line-height:1.5">${safeNote}</p>
        </div>
      ` : ''

  await sendMail({
    to,
    subject: subjects[eventType] || `"${contractTitle}" гэрээний шинэчлэл`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <h2 style="color:#1e1b4b">${headlines[eventType] || 'Гэрээний шинэчлэл'}</h2>
        <p>${descriptions[eventType] || ''}</p>
        ${noteHtml}
        ${contractUrl ? `
          <a href="${contractUrl}"
             style="display:inline-block;padding:12px 24px;background:#1e1b4b;
                    color:white;text-decoration:none;border-radius:8px;margin-top:16px">
            Гэрээг харах
          </a>
        ` : ''}
      </div>
    `,
  })
}

// ── Гарын үсэг зурахын өмнөх OTP — гэрээний контекст-той ──
// signContract-д ашиглана. Хэрэглэгчийн нэвтэрсэн имэйл рүү л явна
// (хэрэглэгч өөрөө имэйл өгөхгүй — req.user.email).
const sendSignOtpEmail = async (email, code, contractTitle) => {
  // contractTitle нь хэрэглэгчээс ирсэн string — HTML escape хийнэ
  const safeTitle = contractTitle
    ? String(contractTitle)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : 'Гэрээ'

  await sendMail({
    to:      email,
    subject: 'Гарын үсэг баталгаажуулах код',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px">
        <h2 style="color:#1e1b4b">Гарын үсэг баталгаажуулах</h2>
        <p style="color:#444;margin:0 0 12px 0">
          "<strong>${safeTitle}</strong>" гэрээнд гарын үсэг зурахын өмнө
          таны өөрийг чинь мөн эсэхийг баталгаажуулна.
        </p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                    color:#1e1b4b;padding:16px;background:#f5f5ff;
                    border-radius:8px;text-align:center">${code}</div>
        <p style="color:#666;margin-top:16px">
          Энэ код <strong>${process.env.OTP_EXPIRES_MIN || 5} минут</strong> хүчинтэй.
        </p>
        <p style="color:#999;font-size:12px;margin-top:16px">
          Хэрэв та энэ хүсэлтийг хийгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </p>
      </div>
    `,
  })
}

module.exports = { sendOtpEmail, sendInviteEmail, sendContractEventEmail, sendSignOtpEmail }
