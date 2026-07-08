const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const CERT_WIDTH = 842; // A4 landscape width in points
const CERT_HEIGHT = 595; // A4 landscape height in points

const BORDER_STYLES = {
  'double-gold': (doc, accent) => {
    doc.save();
    doc
      .rect(20, 20, CERT_WIDTH - 40, CERT_HEIGHT - 40)
      .lineWidth(3)
      .strokeColor(accent)
      .stroke();
    doc
      .rect(30, 30, CERT_WIDTH - 60, CERT_HEIGHT - 60)
      .lineWidth(1)
      .strokeColor(accent)
      .stroke();
    doc.restore();
  },
  'modern-block': (doc, accent) => {
    doc.save();
    doc.rect(0, 0, CERT_WIDTH, 8).fill(accent);
    doc.rect(0, CERT_HEIGHT - 8, CERT_WIDTH, 8).fill(accent);
    doc.rect(0, 0, 8, CERT_HEIGHT).fill(accent);
    doc.rect(CERT_WIDTH - 8, 0, 8, CERT_HEIGHT).fill(accent);
    doc.restore();
  },
  'thin-script': (doc, accent) => {
    doc.save();
    doc
      .rect(40, 40, CERT_WIDTH - 80, CERT_HEIGHT - 80)
      .lineWidth(0.5)
      .strokeColor(accent)
      .stroke();
    doc.restore();
  },
};

function generateCertificatePDF(data, templateData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const {
        recipientName = 'Recipient',
        title = 'Certificate of Achievement',
        body = 'This is to certify that',
        issuer = 'InternOps',
        issueDate = new Date().toISOString().slice(0, 10),
        certificateType = 'achievement',
        certificateNumber = null,
        background = '#FFFFFF',
        accent = '#b8860b',
        textColor = '#1a1a1a',
        border = 'double-gold',
      } = { ...templateData, ...data };

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background
      doc.save();
      doc.rect(0, 0, CERT_WIDTH, CERT_HEIGHT).fill(background);
      doc.restore();

      // Border
      if (BORDER_STYLES[border]) {
        BORDER_STYLES[border](doc, accent);
      }

      // Certificate Type / Header
      doc.save();
      doc
        .font('Helvetica-Bold')
        .fontSize(32)
        .fillColor(accent)
        .text(title.toUpperCase(), 0, 120, {
          align: 'center',
          width: CERT_WIDTH,
        });
      doc.restore();

      // Decorative line
      doc.save();
      doc
        .moveTo(CERT_WIDTH / 2 - 150, 170)
        .lineTo(CERT_WIDTH / 2 + 150, 170)
        .lineWidth(2)
        .strokeColor(accent)
        .stroke();
      doc.restore();

      // "This is to certify that"
      doc.save();
      doc
        .font('Helvetica')
        .fontSize(16)
        .fillColor(textColor)
        .text('This is to certify that', 0, 200, {
          align: 'center',
          width: CERT_WIDTH,
        });
      doc.restore();

      // Recipient name
      doc.save();
      doc
        .font('Helvetica-Bold')
        .fontSize(28)
        .fillColor(accent)
        .text(recipientName, 0, 240, {
          align: 'center',
          width: CERT_WIDTH,
        });
      doc.restore();

      // Underline for name
      const nameWidth = doc.widthOfString(recipientName);
      const nameX = (CERT_WIDTH - nameWidth) / 2;
      doc.save();
      doc
        .moveTo(nameX, 275)
        .lineTo(nameX + nameWidth, 275)
        .lineWidth(1)
        .strokeColor(accent)
        .stroke();
      doc.restore();

      // Body text
      if (body) {
        doc.save();
        doc
          .font('Helvetica')
          .fontSize(14)
          .fillColor(textColor)
          .text(body, 100, 295, {
            align: 'center',
            width: CERT_WIDTH - 200,
          });
        doc.restore();
      }

      // Issuer and Date
      doc.save();
      doc.font('Helvetica').fontSize(12).fillColor(textColor);

      // Issuer line
      doc.text(issuer, 100, CERT_HEIGHT - 120, {
        align: 'center',
        width: 250,
      });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Issued By', 100, CERT_HEIGHT - 140, {
          align: 'center',
          width: 250,
        });

      // Date
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(issueDate, CERT_WIDTH - 350, CERT_HEIGHT - 120, {
          align: 'center',
          width: 250,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Date of Issue', CERT_WIDTH - 350, CERT_HEIGHT - 140, {
          align: 'center',
          width: 250,
        });
      doc.restore();

      // Signature line
      doc.save();
      doc
        .moveTo(150, CERT_HEIGHT - 90)
        .lineTo(350, CERT_HEIGHT - 90)
        .lineWidth(0.5)
        .strokeColor(textColor)
        .stroke();
      doc.restore();

      // Date line
      doc.save();
      doc
        .moveTo(CERT_WIDTH - 350, CERT_HEIGHT - 90)
        .lineTo(CERT_WIDTH - 150, CERT_HEIGHT - 90)
        .lineWidth(0.5)
        .strokeColor(textColor)
        .stroke();
      doc.restore();

      // Certificate number (if provided)
      if (certificateNumber) {
        doc.save();
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(textColor)
          .text(`Certificate No: ${certificateNumber}`, 0, CERT_HEIGHT - 35, {
            align: 'center',
            width: CERT_WIDTH,
          });
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificatePDF };
