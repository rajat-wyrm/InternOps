import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const EXPORT_FORMATS = [
  {
    value: 'xlsx',
    label: 'Microsoft Excel (.xlsx)',
    group: 'Spreadsheets',
    recommended: true,
  },
  {
    value: 'ods',
    label: 'OpenDocument Spreadsheet (.ods)',
    group: 'Spreadsheets',
  },
  { value: 'pdf', label: 'PDF Document (.pdf)', group: 'Share & print' },
  { value: 'html', label: 'Web Page (.html)', group: 'Share & print' },
  { value: 'csv', label: 'Comma-Separated Values (.csv)', group: 'Raw data' },
  { value: 'tsv', label: 'Tab-Separated Values (.tsv)', group: 'Raw data' },
];
export function safeFilePart(value) {
  return (
    String(value || 'department')
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'department'
  );
}
export function makeExportFileName(type, department, month, extension) {
  return `${safeFilePart(type)}-${safeFilePart(department)}-${safeFilePart(month)}.${extension}`;
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function normalizeExportValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'no record'
    ? ''
    : value;
}

function quote(value, separator) {
  const text = String(normalizeExportValue(value) ?? '');
  return text.includes(separator) || /["\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}
export function rowsToDelimited(columns, rows, separator) {
  return [
    columns.map((c) => quote(c.label, separator)).join(separator),
    ...rows.map((row) =>
      columns.map((c) => quote(row[c.key], separator)).join(separator)
    ),
  ].join('\r\n');
}
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
function tone(value) {
  const text = String(value ?? '').toUpperCase();
  const score = Number(value);
  if (Number.isFinite(score))
    return score >= 8 ? 'good' : score >= 5 ? 'warn' : 'bad';
  if (text.includes('PRESENT') || text === 'ACTIVE' || text === 'JOINED')
    return 'good';
  if (
    text.includes('ABSENT') ||
    text === 'TERMINATED' ||
    text === 'DISCONTINUED'
  )
    return 'bad';
  if (
    text.includes('INFORMED') ||
    text.includes('LEAVE') ||
    text === 'COMPLETED'
  )
    return 'info';
  return '';
}
export function rowsToHtml(title, columns, rows) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#0f172a;background:#f8fafc}.report{background:#fff;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden}.hero{padding:22px 24px;background:linear-gradient(135deg,#312e81,#2563eb);color:#fff}.hero h1{margin:0;font-size:24px}.hero p{margin:7px 0 0;color:#dbeafe}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:11px}thead{display:table-header-group}th{background:#172033;color:#fff;font-weight:700}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top;white-space:pre-wrap}tbody tr:nth-child(even){background:#f1f5f9}.good{background:#dcfce7;color:#166534;font-weight:700}.warn{background:#fef3c7;color:#92400e;font-weight:700}.bad{background:#fee2e2;color:#991b1b;font-weight:700}.info{background:#dbeafe;color:#1e40af;font-weight:700}.footer{padding:10px 24px;color:#64748b;font-size:10px}</style></head><body><section class="report"><header class="hero"><h1>${esc(title)}</h1><p>Generated ${esc(new Date().toLocaleString())}</p></header><div class="table-wrap"><table><colgroup>${columns
    .map((column, index) => {
      let width;

      if (index === 0) width = 70;
      else if (index === 1) width = 220;
      else if (index === 2) width = 290;
      else if (index === 3) width = 175;
      else if (index === 4) width = 130;
      else if (index === 5) width = 160;
      else if (column.key.startsWith('reason')) width = 340;
      else if (column.key.startsWith('rating')) width = 160;
      else width = Math.max(115, Math.min(250, (column.width || 18) * 9));

      return `<col style="min-width:${width}px">`;
    })
    .join(
      ''
    )}</colgroup><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td class="${c.key === '__serialNumber' ? '' : tone(r[c.key])}">${esc(normalizeExportValue(r[c.key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><footer class="footer">InternOps generated report</footer></section></body></html>`;
}
async function exportExcel({ title, fileBase, sheetName, columns, rows }) {
  const book = new ExcelJS.Workbook();
  book.creator = 'InternOps';
  book.created = new Date();
  const sheet = book.addWorksheet(sheetName.slice(0, 31), {
    views: [
      { state: 'frozen', xSplit: Math.min(6, columns.length), ySplit: 3 },
    ],
  });
  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, columns.length);
  const meta = sheet.getCell(2, 1);
  meta.value = `Generated ${new Date().toLocaleString()} | InternOps`;
  meta.font = { italic: true, color: { argb: 'FF475569' } };
  meta.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' },
  };
  sheet.addRow(columns.map((c) => c.label));
  const header = sheet.getRow(3);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF172033' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FF64748B' } },
      bottom: { style: 'thin', color: { argb: 'FF64748B' } },
      right: { style: 'thin', color: { argb: 'FF64748B' } },
    };
  });
  rows.forEach((record, index) => {
    const row = sheet.addRow(
      columns.map((c) => normalizeExportValue(record[c.key]) ?? '')
    );
    row.eachCell((cell, col) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index % 2 ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      const isSerialNumber = columns[col - 1]?.key === '__serialNumber';

      if (isSerialNumber) {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF334155' },
        };
        return;
      }

      const t = tone(cell.value);
      const colors = {
        good: ['FFDCFCE7', 'FF166534'],
        warn: ['FFFEF3C7', 'FF92400E'],
        bad: ['FFFEE2E2', 'FF991B1B'],
        info: ['FFDBEAFE', 'FF1E40AF'],
      }[t];
      if (colors) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colors[0] },
        };
        cell.font = { bold: true, color: { argb: colors[1] } };
      }
    });
  });
  sheet.columns = columns.map((c) => ({
    width: Math.min(55, Math.max(12, c.width || 18)),
  }));
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: columns.length },
  };
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  sheet.headerFooter.oddFooter = 'Page &P of &N';
  const buffer = await book.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${fileBase}.xlsx`
  );
}
function exportOds({ title, fileBase, sheetName, columns, rows }) {
  const data = [
    [title],
    [`Generated ${new Date().toLocaleString()} | InternOps`],
    [],
    columns.map((column) => column.label),
    ...rows.map((row) =>
      columns.map((column) => normalizeExportValue(row[column.key]) ?? '')
    ),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);

  sheet['!merges'] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(columns.length - 1, 0) },
    },
    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: Math.max(columns.length - 1, 0) },
    },
  ];

  sheet['!cols'] = columns.map((column, index) => {
    if (index === 0) return { wch: 9 };
    if (index === 1) return { wch: 30 };
    if (index === 2) return { wch: 38 };
    if (index === 3) return { wch: 24 };
    if (index === 4) return { wch: 18 };
    if (index === 5) return { wch: 22 };

    if (column.key.startsWith('reason')) {
      return { wch: 48 };
    }

    if (column.key.startsWith('rating')) {
      return { wch: 22 };
    }

    return {
      wch: Math.min(28, Math.max(14, column.width || 18)),
    };
  });

  sheet['!rows'] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 8 }, { hpt: 28 }];

  const lastRow = Math.max(data.length - 1, 3);
  const lastColumn = Math.max(columns.length - 1, 0);

  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 3, c: 0 },
      e: { r: lastRow, c: lastColumn },
    }),
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${fileBase}.ods`, {
    bookType: 'ods',
  });
}

const PDF_IDENTITY_COLUMNS = 6;
const ATTENDANCE_PDF_DATE_COLUMNS = 7;
const RATINGS_PDF_WEEK_COLUMNS = 2;

function compactPdfValue(value) {
  const text = String(value ?? '');
  const normalized = text.toUpperCase();
  const compact = {
    PRESENT: 'P',
    ABSENT: 'A',
    INFORMED: 'I',
    LEAVE: 'L',
    HALF_DAY: 'H',
    'NO RECORD': '',
  };
  return compact[normalized] ?? text;
}

export function splitPdfColumnGroups(columns, sheetName = 'Report') {
  const identity = columns.slice(0, PDF_IDENTITY_COLUMNS);
  const dynamic = columns.slice(PDF_IDENTITY_COLUMNS);
  if (!dynamic.length) return [columns];
  const isRatings = String(sheetName).toLowerCase().includes('rating');
  const groupSize = isRatings
    ? RATINGS_PDF_WEEK_COLUMNS
    : ATTENDANCE_PDF_DATE_COLUMNS;
  const groups = [];
  for (let index = 0; index < dynamic.length; index += groupSize) {
    groups.push([...identity, ...dynamic.slice(index, index + groupSize)]);
  }
  return groups;
}

function drawPdfBrandHeader(doc, title, sectionLabel) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(49, 46, 129);
  doc.rect(0, 0, width, 62, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(width - 185, 0, 185, 62, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(title, 30, 31, { maxWidth: width - 245 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(sectionLabel, 30, 49);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated ${new Date().toLocaleString()} | InternOps`, 30, 79);
}

function pdfColumnStyles(columns, isRatings) {
  const styles = {};

  if (isRatings) {
    const widths = [44, 155, 205, 125, 75, 105, 90, 335];

    columns.forEach((column, index) => {
      styles[index] = {
        cellWidth: widths[index] || 90,
      };

      if (
        column.key === '__serialNumber' ||
        column.key === 'role' ||
        column.key === 'status' ||
        column.key.startsWith('rating')
      ) {
        styles[index].halign = 'center';
      }

      if (column.key === '__serialNumber' || column.key === 'member') {
        styles[index].fontStyle = 'bold';
      }
    });

    return styles;
  }

  const attendanceWidths = [42, 150, 205, 125, 75, 110];

  columns.forEach((column, index) => {
    styles[index] = {
      cellWidth: index < attendanceWidths.length ? attendanceWidths[index] : 61,
    };

    if (
      column.key === '__serialNumber' ||
      column.key === 'role' ||
      column.key === 'status' ||
      index >= PDF_IDENTITY_COLUMNS
    ) {
      styles[index].halign = 'center';
    }

    if (column.key === '__serialNumber' || column.key === 'member') {
      styles[index].fontStyle = 'bold';
    }
  });

  return styles;
}

function exportPdf({ title, fileBase, sheetName = 'Report', columns, rows }) {
  const isRatings = String(sheetName).toLowerCase().includes('rating');
  const groups = splitPdfColumnGroups(columns, sheetName);
  const pageWidth = 1190;
  const pageMargin = 28;
  const tableStartY = 92;
  const footerSpace = 46;

  const createTableBody = (group) =>
    rows.map((row) =>
      group.map((column, columnIndex) => {
        const value = normalizeExportValue(row[column.key]);

        return !isRatings && columnIndex >= PDF_IDENTITY_COLUMNS
          ? compactPdfValue(value)
          : (value ?? '');
      })
    );

  const applyCellStyle = (group, data) => {
    if (data.section !== 'body') return;

    const value = data.cell.raw;
    const currentColumn = group[data.column.index];
    const isSerialNumber = currentColumn?.key === '__serialNumber';

    if (isSerialNumber) {
      data.cell.styles.fillColor =
        data.row.index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      data.cell.styles.textColor = [51, 65, 85];
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.halign = 'center';
      return;
    }

    if (value === '' || value == null) {
      data.cell.styles.fillColor =
        data.row.index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      return;
    }

    const cellTone = tone(value);

    if (cellTone === 'good') {
      data.cell.styles.fillColor = [220, 252, 231];
      data.cell.styles.textColor = [22, 101, 52];
      data.cell.styles.fontStyle = 'bold';
    } else if (cellTone === 'warn') {
      data.cell.styles.fillColor = [254, 243, 199];
      data.cell.styles.textColor = [146, 64, 14];
      data.cell.styles.fontStyle = 'bold';
    } else if (cellTone === 'bad') {
      data.cell.styles.fillColor = [254, 226, 226];
      data.cell.styles.textColor = [153, 27, 27];
      data.cell.styles.fontStyle = 'bold';
    } else if (cellTone === 'info') {
      data.cell.styles.fillColor = [219, 234, 254];
      data.cell.styles.textColor = [30, 64, 175];
      data.cell.styles.fontStyle = 'bold';
    }
  };

  const createTableOptions = (group) => ({
    startY: tableStartY,
    margin: {
      left: pageMargin,
      right: pageMargin,
      bottom: 18,
    },
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    showHead: 'firstPage',
    head: [group.map((column) => column.label)],
    body: createTableBody(group),
    theme: 'grid',
    tableWidth: 1134,
    styles: {
      font: 'helvetica',
      fontSize: isRatings ? 8 : 8.5,
      cellPadding: isRatings ? 5 : 4,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.45,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [23, 32, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 30,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: pdfColumnStyles(group, isRatings),
    didParseCell: (data) => applyCellStyle(group, data),
  });

  const measuredGroups = groups.map((group) => {
    const measurementHeight = Math.max(3000, 250 + rows.length * 90);

    const measurementDocument = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [pageWidth, measurementHeight],
    });

    autoTable(measurementDocument, createTableOptions(group));

    const tableEndY =
      measurementDocument.lastAutoTable?.finalY || tableStartY + 100;

    return {
      group,
      pageHeight: Math.max(300, Math.ceil(tableEndY + footerSpace)),
    };
  });

  const firstPageHeight = measuredGroups[0]?.pageHeight || 842;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidth, firstPageHeight],
  });

  measuredGroups.forEach(({ group, pageHeight }, groupIndex) => {
    if (groupIndex > 0) {
      doc.addPage([pageWidth, pageHeight], 'portrait');
    }

    const dynamicLabels = group
      .slice(PDF_IDENTITY_COLUMNS)
      .map((column) => column.label);

    const ratingPeriodMatch = isRatings
      ? dynamicLabels[0]?.match(/\(([^)]+)\)/)
      : null;

    const sectionLabel = isRatings
      ? `Week ${groupIndex + 1} of ${groups.length} | ${
          ratingPeriodMatch?.[1] || 'Rating period'
        }`
      : dynamicLabels.length
        ? `Section ${groupIndex + 1} of ${
            groups.length
          } | ${dynamicLabels[0]} to ${dynamicLabels.at(-1)}`
        : `Section ${groupIndex + 1} of ${groups.length}`;

    drawPdfBrandHeader(doc, title, sectionLabel);

    autoTable(doc, createTableOptions(group));

    const footerLineY = pageHeight - 27;
    const footerTextY = pageHeight - 12;

    doc.setDrawColor(226, 232, 240);
    doc.line(pageMargin, footerLineY, pageWidth - pageMargin, footerLineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    doc.text('InternOps generated report', pageMargin, footerTextY);

    const footerLabel = isRatings
      ? `Week ${groupIndex + 1} of ${groups.length}`
      : `Section ${groupIndex + 1} of ${groups.length}`;

    doc.text(footerLabel, pageWidth - 115, footerTextY);
  });

  doc.save(`${fileBase}.pdf`);
}

export async function exportTable(options) {
  const { format, title, fileBase, columns, rows } = options;

  if (!rows.length) {
    throw new Error('There is no visible data to export.');
  }

  const serialColumn = {
    key: '__serialNumber',
    label: 'S. No.',
    width: 9,
  };

  const exportColumns = columns.some(
    (column) => column.key === serialColumn.key
  )
    ? columns
    : [serialColumn, ...columns];

  const exportRows = rows.map((row, index) => ({
    ...row,
    __serialNumber: index + 1,
  }));

  const preparedOptions = {
    ...options,
    columns: exportColumns,
    rows: exportRows,
  };

  if (format === 'xlsx') {
    return exportExcel(preparedOptions);
  }

  if (format === 'ods') {
    return exportOds(preparedOptions);
  }

  if (format === 'pdf') {
    return exportPdf(preparedOptions);
  }

  if (format === 'html') {
    return downloadBlob(
      new Blob([rowsToHtml(title, exportColumns, exportRows)], {
        type: 'text/html;charset=utf-8',
      }),
      `${fileBase}.html`
    );
  }

  const separator = format === 'csv' ? ',' : '\t';

  return downloadBlob(
    new Blob(
      ['\ufeff', rowsToDelimited(exportColumns, exportRows, separator)],
      {
        type: 'text/plain;charset=utf-8',
      }
    ),
    `${fileBase}.${format}`
  );
}
