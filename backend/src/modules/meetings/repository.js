const pool = require('../../config/db');

async function createMeeting({
  title,
  description,
  meetingDate,
  meetingUrl,
  startTime,
  endTime,
  createdBy,
  departmentId,
}) {
  const res = await pool.query(
    `INSERT INTO meetings (title, description, meeting_date, meeting_url, start_time, end_time, created_by, department_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      title,
      description,
      meetingDate,
      meetingUrl,
      startTime,
      endTime,
      createdBy,
      departmentId,
    ]
  );
  return res.rows[0];
}

async function addAttendee(meetingId, userId) {
  await pool.query(
    'INSERT INTO meeting_attendees (meeting_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [meetingId, userId]
  );
}

async function removeAttendee(meetingId, userId) {
  await pool.query(
    'DELETE FROM meeting_attendees WHERE meeting_id=$1 AND user_id=$2',
    [meetingId, userId]
  );
}

async function listMeetings({
  userId,
  departmentId,
  requestedDepartmentId,
  fromDate,
  toDate,
  page = 1,
  limit = 20,
}) {
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countParams = [];
  const dataParams = [];

  let countQuery = `
    SELECT COUNT(DISTINCT m.id) AS count
    FROM meetings m
    LEFT JOIN meeting_attendees a 
      ON m.id = a.meeting_id
    WHERE m.deleted_at IS NULL
  `;

  let dataQuery = `
    SELECT DISTINCT m.*
    FROM meetings m
    LEFT JOIN meeting_attendees a 
      ON m.id = a.meeting_id
    WHERE m.deleted_at IS NULL
  `;

  let condIdx = 1;

  const selectedDepartmentId = requestedDepartmentId || departmentId;

  if (userId) {
    const accessConditions = [
      `m.created_by = $${condIdx}`,
      `a.user_id = $${condIdx}`,
    ];

    countParams.push(userId);
    dataParams.push(userId);

    condIdx++;

    if (selectedDepartmentId) {
      accessConditions.push(`m.department_id = $${condIdx}`);

      countParams.push(selectedDepartmentId);
      dataParams.push(selectedDepartmentId);

      condIdx++;
    }

    const accessQuery = `
    AND (${accessConditions.join(' OR ')})
  `;

    countQuery += accessQuery;
    dataQuery += accessQuery;
  }

  if (fromDate) {
    countQuery += ` AND m.meeting_date >= $${condIdx}`;
    dataQuery += ` AND m.meeting_date >= $${condIdx}`;

    countParams.push(fromDate);
    dataParams.push(fromDate);

    condIdx++;
  }

  if (toDate) {
    countQuery += ` AND m.meeting_date <= $${condIdx}`;
    dataQuery += ` AND m.meeting_date <= $${condIdx}`;

    countParams.push(toDate);
    dataParams.push(toDate);

    condIdx++;
  }

  dataQuery += `
    ORDER BY m.meeting_date DESC,
    m.start_time DESC
    LIMIT $${condIdx}
    OFFSET $${condIdx + 1}
  `;

  dataParams.push(safeLimit, offset);

  const countResult = await pool.query(countQuery, countParams);

  const dataResult = await pool.query(dataQuery, dataParams);

  const total = Number(countResult.rows[0].count);

  return {
    data: dataResult.rows,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

async function getMeetingById(meetingId) {
  const res = await pool.query(
    'SELECT * FROM meetings WHERE id=$1 AND deleted_at IS NULL',
    [meetingId]
  );
  return res.rows[0] || null;
}

async function updateMeeting(meetingId, fields) {
  const set = [];
  const vals = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    if (
      [
        'title',
        'description',
        'meeting_date',
        'meeting_url',
        'start_time',
        'end_time',
      ].includes(key)
    ) {
      set.push(`${key} = $${idx}`);
      vals.push(val);
      idx++;
    }
  }
  if (set.length === 0) return null;
  vals.push(meetingId);
  const res = await pool.query(
    `UPDATE meetings SET ${set.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    vals
  );
  return res.rows[0];
}

async function softDeleteMeeting(meetingId) {
  await pool.query('UPDATE meetings SET deleted_at = NOW() WHERE id=$1', [
    meetingId,
  ]);
}

async function getAttendees(meetingId) {
  const res = await pool.query(
    `SELECT u.id, u.email, u.role, u.full_name
     FROM meeting_attendees a
     JOIN users u ON a.user_id = u.id AND u.deleted_at IS NULL AND u.suspended = FALSE
     WHERE a.meeting_id = $1`,
    [meetingId]
  );
  return res.rows;
}

async function getUserDepartmentId(userId) {
  const res = await pool.query(
    'SELECT department_id FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return res.rows[0]?.department_id || null;
}

async function userExists(userId) {
  const res = await pool.query(
    'SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL AND suspended = FALSE',
    [userId]
  );
  return res.rowCount > 0;
}

module.exports = {
  createMeeting,
  addAttendee,
  removeAttendee,
  listMeetings,
  getMeetingById,
  updateMeeting,
  softDeleteMeeting,
  getAttendees,
  getUserDepartmentId,
  userExists,
};
