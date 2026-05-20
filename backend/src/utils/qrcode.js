// QR код үүсгэх — `qrcode` npm пакетыг суулгасан байх ёстой:
//   npm install qrcode
const QRCode = require('qrcode')

// text-г PNG data URL (base64) болгож буцаана.
// Жишээ: 'data:image/png;base64,iVBORw0K...'
// Frontend нь <img src={dataUrl} /> хэлбэрээр шууд харуулж чадна.
const generateQRDataUrl = async (text) => {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark:  '#1e1b4b',
      light: '#ffffff',
    },
  })
}

module.exports = { generateQRDataUrl }
