const QRCode = require('qrcode');

async function generateQRCode(text, options = {}) {
  const {
    width = 300,
    margin = 2,
    color = { dark: '#000000', light: '#FFFFFF' },
  } = options;

  const buffer = await QRCode.toBuffer(text, {
    width,
    margin,
    color,
    errorCorrectionLevel: 'M',
  });

  return buffer;
}

async function generateQRCodeDataURL(text, options = {}) {
  const { width = 300, margin = 2 } = options;

  const dataURL = await QRCode.toDataURL(text, {
    width,
    margin,
    errorCorrectionLevel: 'M',
  });

  return dataURL;
}

module.exports = { generateQRCode, generateQRCodeDataURL };
