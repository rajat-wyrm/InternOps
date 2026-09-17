const fs = require('fs');
const path = require('path');

// Simple CSV helper to handle quoted values with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map((val) => val.replace(/^"|"$/g, '').trim());
}

function getSummary(startDate, endDate) {
  const attendanceFilePath = path.resolve(
    __dirname,
    '../../../../attendance.csv'
  );
  const ratingsFilePath = path.resolve(__dirname, '../../../../ratings.csv');

  let attendanceRecords = [];
  try {
    const attendanceData = fs.readFileSync(attendanceFilePath, 'utf8');
    const lines = attendanceData.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 4) continue;
      attendanceRecords.push({
        email: cols[0],
        name: cols[1],
        date: cols[2],
        status: cols[3],
        arrivalTime: cols[4] || null,
      });
    }
  } catch (err) {
    console.error('Error reading attendance.csv:', err);
  }

  let ratingsRecords = [];
  try {
    const ratingsData = fs.readFileSync(ratingsFilePath, 'utf8');
    const lines = ratingsData.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 4) continue;
      ratingsRecords.push({
        email: cols[0],
        name: cols[1],
        date: cols[2],
        score: parseFloat(cols[3]),
        remarks: cols[4] || '',
      });
    }
  } catch (err) {
    console.error('Error reading ratings.csv:', err);
  }

  // Deduplicate interns using their email
  const internsMap = new Map();
  for (const record of [...attendanceRecords, ...ratingsRecords]) {
    if (record.email && !internsMap.has(record.email)) {
      internsMap.set(record.email, {
        id: record.email,
        name: record.name,
        email: record.email,
      });
    }
  }

  const result = [];

  for (const intern of internsMap.values()) {
    // Filter attendance in range (inclusive)
    const atts = attendanceRecords
      .filter(
        (r) =>
          r.email === intern.email && r.date >= startDate && r.date <= endDate
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    // Filter ratings in range (inclusive)
    const rats = ratingsRecords
      .filter(
        (r) =>
          r.email === intern.email && r.date >= startDate && r.date <= endDate
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalAttendance = atts.length;
    const presentDays = atts.filter(
      (r) => r.status.toUpperCase() === 'PRESENT'
    ).length;
    const attendancePercentage =
      totalAttendance === 0
        ? 100
        : Math.round((presentDays / totalAttendance) * 100);

    const numRatings = rats.length;
    const avgRating =
      numRatings === 0
        ? 0
        : parseFloat(
            (rats.reduce((sum, r) => sum + r.score, 0) / numRatings).toFixed(2)
          );
    const latestRating = numRatings > 0 ? rats[rats.length - 1].score : 0;

    let ratingTrend = 'INSUFFICIENT';
    if (numRatings >= 2) {
      const latest = rats[rats.length - 1].score;
      const prev = rats[rats.length - 2].score;
      if (latest > prev) {
        ratingTrend = 'UP';
      } else if (latest < prev) {
        ratingTrend = 'DOWN';
      } else {
        ratingTrend = 'STABLE';
      }
    }

    let status = 'Good';
    if (numRatings === 0) {
      status = 'Missing Data';
    } else if (avgRating < 4.0 || attendancePercentage < 80) {
      status = 'Attention Required';
    }

    result.push({
      ...intern,
      totalAttendance,
      presentDays,
      attendancePercentage,
      numRatings,
      avgRating,
      latestRating,
      ratingTrend,
      status,
      ratingsHistory: rats.map((r) => ({
        date: r.date,
        score: r.score,
        remarks: r.remarks,
      })),
      attendanceHistory: atts.map((a) => ({
        date: a.date,
        status: a.status,
        arrivalTime: a.arrivalTime,
      })),
    });
  }

  return result;
}

module.exports = {
  getSummary,
};
