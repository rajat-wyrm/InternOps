function getFourWeekRatingPeriods(monthValue) {
  if (!/^\d{4}-\d{2}$/.test(String(monthValue || ''))) return [];
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, '0');
  const date = (day) => `${year}-${pad(month)}-${pad(day)}`;
  return [
    { week: 1, start: date(1), end: date(7) },
    { week: 2, start: date(8), end: date(14) },
    { week: 3, start: date(15), end: date(21) },
    { week: 4, start: date(22), end: date(lastDay) },
  ];
}
function getFourWeekIndex(dateValue) {
  const day = Number(String(dateValue || '').slice(8, 10));
  if (!Number.isInteger(day) || day < 1 || day > 31) return -1;
  return day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
}

function getCurrentFourWeekRatingPeriod(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const monthValue = `${year}-${month}`;
  const weekIndex = getFourWeekIndex(now.toISOString().slice(0, 10));
  return {
    month: monthValue,
    index: weekIndex,
    period: getFourWeekRatingPeriods(monthValue)[weekIndex],
  };
}
function isCurrentFourWeekPeriod(start, end, now = new Date()) {
  const current = getCurrentFourWeekRatingPeriod(now).period;
  return Boolean(current && current.start === start && current.end === end);
}

function validateFourWeekPeriod(start, end) {
  const month = String(start || '').slice(0, 7);
  return getFourWeekRatingPeriods(month).some(
    (p) => p.start === start && p.end === end
  );
}
module.exports = {
  getFourWeekRatingPeriods,
  getFourWeekIndex,
  validateFourWeekPeriod,
  getCurrentFourWeekRatingPeriod,
  isCurrentFourWeekPeriod,
};
