const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const CERT_WIDTH = 842; // A4 landscape width in points
const CERT_HEIGHT = 595; // A4 landscape height in points

const LOGO_PATH = path.join(__dirname, 'assets', 'uptoskills-logo.png');
const SEAL_PATH = path.join(__dirname, 'assets', 'uptoskills-seal.png');

const COLORS = {
  outerBorder: '#1D4ED8', // royal blue frame
  innerBorder: '#F0B429', // gold inner line
  title: '#1D4ED8',
  subtitle: '#334155',
  muted: '#64748B',
  text: '#1E293B',
  name: '#0F172A',
};

function generateCertificatePDF(data, templateData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const {
        recipientName = 'Recipient',
        title = 'Certificate',
        subtitle = 'Of Internship Completion',
        body = '',
        roleLine = '', // e.g. "has successfully completed their internship as Captain of domain"
        domain = '', // e.g. "MERN STACK"
        dateRange = '', // e.g. "from 16 March 2026 to 16 June 2026"
        issuer = 'Authorized Signatory',
        issueDate = new Date().toISOString().slice(0, 10),
        certificateNumber = null,
        verifyEmail = 'recruitment@uptoskills.com',
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

      // ---- Background ----
      doc.rect(0, 0, CERT_WIDTH, CERT_HEIGHT).fill('#FFFFFF');

      // ---- Outer thick blue frame + inner gold line ----
      const OUTER = 18;
      doc.save();
      doc.rect(0, 0, CERT_WIDTH, CERT_HEIGHT).fill(COLORS.outerBorder);
      doc
        .rect(OUTER, OUTER, CERT_WIDTH - OUTER * 2, CERT_HEIGHT - OUTER * 2)
        .fill('#FFFFFF');
      doc.restore();

      const GOLD_INSET = 34;
      doc.save();
      doc
        .rect(
          GOLD_INSET,
          GOLD_INSET,
          CERT_WIDTH - GOLD_INSET * 2,
          CERT_HEIGHT - GOLD_INSET * 2
        )
        .lineWidth(1.2)
        .strokeColor(COLORS.innerBorder)
        .stroke();
      doc.restore();

      // ---- Logo ----
      if (fs.existsSync(LOGO_PATH)) {
        const logoWidth = 190;
        doc.image(LOGO_PATH, (CERT_WIDTH - logoWidth) / 2, 42, {
          width: logoWidth,
        });
      }

      // ---- Title ----
      doc
        .font('Times-Bold')
        .fontSize(40)
        .fillColor(COLORS.title)
        .text(title.toUpperCase(), 0, 152, {
          align: 'center',
          width: CERT_WIDTH,
          characterSpacing: 6,
        });

      // ---- Subtitle ----
      doc
        .font('Times-Bold')
        .fontSize(16)
        .fillColor(COLORS.subtitle)
        .text(subtitle.toUpperCase(), 0, 200, {
          align: 'center',
          width: CERT_WIDTH,
          characterSpacing: 3,
        });

      // ---- "This is to certify that" ----
      doc
        .font('Times-Italic')
        .fontSize(14)
        .fillColor(COLORS.muted)
        .text('This is to certify that', 0, 240, {
          align: 'center',
          width: CERT_WIDTH,
        });

      // ---- Recipient name ----
      doc
        .font('Times-Bold')
        .fontSize(30)
        .fillColor(COLORS.name)
        .text(recipientName, 0, 265, {
          align: 'center',
          width: CERT_WIDTH,
        });

      // ---- Role line ----
      let cursorY = 315;
      if (roleLine) {
        doc
          .font('Times-Roman')
          .fontSize(14)
          .fillColor(COLORS.text)
          .text(roleLine, 100, cursorY, {
            align: 'center',
            width: CERT_WIDTH - 200,
          });
        cursorY += 26;
      }

      // ---- Domain ----
      if (domain) {
        doc
          .font('Times-Bold')
          .fontSize(20)
          .fillColor(COLORS.title)
          .text(domain.toUpperCase(), 0, cursorY, {
            align: 'center',
            width: CERT_WIDTH,
          });
        cursorY += 30;
      }

      // ---- Date range ----
      if (dateRange) {
        doc
          .font('Times-Bold')
          .fontSize(12)
          .fillColor(COLORS.text)
          .text(dateRange, 0, cursorY, {
            align: 'center',
            width: CERT_WIDTH,
          });
        cursorY += 28;
      }

      // ---- Description body ----
      if (body) {
        doc
          .font('Times-Italic')
          .fontSize(12)
          .fillColor(COLORS.muted)
          .text(body, 130, cursorY, {
            align: 'center',
            width: CERT_WIDTH - 260,
          });
      }

      // ---- Bottom-left: Certificate ID / Issued On ----
      const footerY = CERT_HEIGHT - 130;
      const barX = 46;

      doc.save();
      doc.rect(barX, footerY, 2.5, 34).fill(COLORS.innerBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text('CERTIFICATE ID', barX + 12, footerY, { characterSpacing: 1 });
      doc
        .font('Courier-Bold')
        .fontSize(11)
        .fillColor(COLORS.title)
        .text(certificateNumber || '—', barX + 12, footerY + 14);
      doc.restore();

      const issuedY = footerY + 40;
      doc.save();
      doc.rect(barX, issuedY, 2.5, 34).fill(COLORS.innerBorder);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text('ISSUED ON', barX + 12, issuedY, { characterSpacing: 1 });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLORS.name)
        .text(issueDate, barX + 12, issuedY + 14);
      doc.restore();

      // ---- Verify line ----
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`Verify by mailing us at ${verifyEmail}`, barX, CERT_HEIGHT - 46);

      // ---- Bottom-right: Seal + Authorized Signatory ----
      const sealWidth = 88;
      const sealX = CERT_WIDTH - 150 - sealWidth / 2 + 30;
      const sealY = CERT_HEIGHT - 200;
      if (fs.existsSync(SEAL_PATH)) {
        doc.image(SEAL_PATH, sealX, sealY, { width: sealWidth });
      }

      const sigLineY = CERT_HEIGHT - 92;
      doc
        .moveTo(CERT_WIDTH - 250, sigLineY)
        .lineTo(CERT_WIDTH - 60, sigLineY)
        .lineWidth(1)
        .strokeColor(COLORS.name)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.name)
        .text('AUTHORIZED SIGNATORY', CERT_WIDTH - 250, sigLineY + 8, {
          align: 'center',
          width: 190,
          characterSpacing: 1,
        });

      doc
        .font('Times-BoldItalic')
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(issuer, CERT_WIDTH - 250, sigLineY + 24, {
          align: 'center',
          width: 190,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificatePDF };
