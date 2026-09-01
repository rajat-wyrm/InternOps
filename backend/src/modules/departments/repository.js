const pool = require('../../config/db');

async function createDepartment(name, createdBy) {
  try {
    const res = await pool.query(
      'INSERT INTO departments (name, created_by) VALUES ($1,$2) RETURNING *',
      [name, createdBy]
    );
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Department name already exists');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function getAll() {
  return (
    await pool.query(
      'SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY name'
    )
  ).rows;
}

async function getDepartmentTeams(departmentId) {
  const { rows } = await pool.query(
    `WITH RECURSIVE leaders AS (
       SELECT id, full_name, role, department_id
       FROM users
       WHERE department_id = $1
         AND role IN ('SENIOR_TL', 'TL', 'CAPTAIN')
         AND deleted_at IS NULL
     ), descendants AS (
       SELECT l.id AS lead_id, u.id AS member_id, u.role AS member_role, 1 AS depth
       FROM leaders l
       JOIN users u ON u.manager_id = l.id AND u.deleted_at IS NULL
       UNION ALL
       SELECT d.lead_id, u.id, u.role, d.depth + 1
       FROM descendants d
       JOIN users u ON u.manager_id = d.member_id AND u.deleted_at IS NULL
       WHERE d.depth < 100
     ), department_totals AS (
       SELECT
         COUNT(*) FILTER (WHERE role <> 'ADMIN')::int AS total_members,
         COUNT(*) FILTER (WHERE role = 'TL')::int AS tl_count,
         COUNT(*) FILTER (WHERE role = 'CAPTAIN')::int AS captain_count,
         COUNT(*) FILTER (WHERE role = 'INTERN')::int AS intern_count
       FROM users
       WHERE department_id = $1 AND deleted_at IS NULL
     )
     SELECT l.id AS lead_id,
            l.full_name AS lead_name,
            l.role,
            CASE
              WHEN l.role = 'SENIOR_TL' THEN GREATEST(dt.total_members - 1, 0)
              ELSE COUNT(DISTINCT d.member_id)::int
            END AS member_count,
            CASE WHEN l.role = 'SENIOR_TL' THEN dt.tl_count
                 ELSE COUNT(DISTINCT d.member_id) FILTER (WHERE d.member_role = 'TL')::int END AS tl_count,
            CASE WHEN l.role = 'SENIOR_TL' THEN dt.captain_count
                 ELSE COUNT(DISTINCT d.member_id) FILTER (WHERE d.member_role = 'CAPTAIN')::int END AS captain_count,
            CASE WHEN l.role = 'SENIOR_TL' THEN dt.intern_count
                 ELSE COUNT(DISTINCT d.member_id) FILTER (WHERE d.member_role = 'INTERN')::int END AS intern_count
     FROM leaders l
     CROSS JOIN department_totals dt
     LEFT JOIN descendants d ON d.lead_id = l.id
     GROUP BY l.id, l.full_name, l.role, dt.total_members, dt.tl_count,
              dt.captain_count, dt.intern_count
     ORDER BY CASE l.role WHEN 'SENIOR_TL' THEN 0 WHEN 'TL' THEN 1 WHEN 'CAPTAIN' THEN 2 ELSE 3 END,
              LOWER(COALESCE(l.full_name, ''))`,
    [departmentId]
  );
  return rows;
}
async function deleteDepartment(id, confirmedName = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const departmentResult = await client.query(
      `SELECT id,name FROM departments WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    const department = departmentResult.rows[0];
    if (!department) {
      await client.query('ROLLBACK');
      return { success: false, notFound: true, userCount: 0 };
    }
    const membersResult = await client.query(
      `SELECT id,role,manager_id FROM users
       WHERE department_id=$1 AND deleted_at IS NULL AND role <> 'ADMIN' FOR UPDATE`,
      [id]
    );
    const members = membersResult.rows;
    const roleCounts = members.reduce(
      (counts, member) => {
        counts[member.role] = (counts[member.role] || 0) + 1;
        return counts;
      },
      { SENIOR_TL: 0, TL: 0, CAPTAIN: 0, INTERN: 0 }
    );
    if (members.length && confirmedName !== department.name) {
      await client.query('ROLLBACK');
      return {
        success: false,
        confirmationRequired: true,
        userCount: members.length,
        roleCounts,
      };
    }
    const memberIds = members.map((member) => member.id);
    if (memberIds.length) {
      await client.query(
        `UPDATE users SET manager_id=NULL,updated_at=NOW()
         WHERE manager_id=ANY($1::uuid[]) AND NOT (id=ANY($1::uuid[]))`,
        [memberIds]
      );
      await client.query(
        'DELETE FROM notifications WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM refresh_tokens WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM password_reset_tokens WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM email_verifications WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query('DELETE FROM ai_usage WHERE user_id=ANY($1::uuid[])', [
        memberIds,
      ]);
      await client.query(
        'DELETE FROM assessments WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM attendance_exemptions WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM meeting_attendees WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM onboarding_checklists WHERE intern_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM proof_submissions WHERE intern_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        'DELETE FROM task_assignments WHERE user_id=ANY($1::uuid[])',
        [memberIds]
      );
      await client.query(
        `UPDATE users SET email='removed+'||id::text||'@deleted.invalid',
         full_name='Removed User',phone=NULL,college=NULL,course=NULL,
         year_of_study=NULL,position=NULL,internship_domain=NULL,
         offer_letter_url=NULL,location=NULL,notes=NULL,avatar_url=NULL,
         intern_code=NULL,manager_id=NULL,department_id=NULL,suspended=TRUE,
         deleted_at=NOW(),updated_at=NOW() WHERE id=ANY($1::uuid[])`,
        [memberIds]
      );
    }
    await client.query(
      `UPDATE departments SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1`,
      [id]
    );
    await client.query('COMMIT');
    return {
      success: true,
      userCount: members.length,
      roleCounts,
      departmentName: department.name,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function handoverSeniorTl(
  departmentId,
  outgoingLeadId,
  replacementId,
  outgoingRole,
  actorId,
  suspendOutgoing = false
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `department-senior-tl:${departmentId}`,
    ]);
    const { rows } = await client.query(
      `SELECT id,role,department_id,manager_id,suspended,deleted_at,full_name
       FROM users WHERE id=ANY($1::uuid[]) FOR UPDATE`,
      [[outgoingLeadId, replacementId]]
    );
    const outgoing = rows.find((user) => user.id === outgoingLeadId);
    const replacement = rows.find((user) => user.id === replacementId);
    if (
      !outgoing ||
      !replacement ||
      outgoing.deleted_at ||
      replacement.deleted_at
    ) {
      throw Object.assign(
        new Error('Outgoing or replacement user was not found'),
        { statusCode: 404 }
      );
    }
    if (
      outgoing.role !== 'SENIOR_TL' ||
      outgoing.department_id !== departmentId
    ) {
      throw Object.assign(
        new Error('Outgoing user is not the department Senior TL'),
        { statusCode: 409 }
      );
    }
    if (replacement.suspended || replacement.department_id !== departmentId) {
      throw Object.assign(
        new Error('Replacement must be active in the same department'),
        { statusCode: 409 }
      );
    }
    if (!['TL', 'CAPTAIN', 'INTERN'].includes(replacement.role)) {
      throw Object.assign(
        new Error('Replacement must be a TL, Captain, or Intern'),
        { statusCode: 409 }
      );
    }
    if (!['TL', 'CAPTAIN', 'INTERN'].includes(outgoingRole)) {
      throw Object.assign(new Error('Outgoing Senior TL role is invalid'), {
        statusCode: 400,
      });
    }
    const reports = await client.query(
      'SELECT role FROM users WHERE manager_id=$1 AND deleted_at IS NULL FOR UPDATE',
      [outgoingLeadId]
    );
    const roleRank = { SENIOR_TL: 3, TL: 2, CAPTAIN: 1, INTERN: 0 };
    if (
      reports.rows.some(
        (row) => (roleRank[row.role] ?? -1) >= roleRank[outgoingRole]
      )
    ) {
      throw Object.assign(
        new Error(
          'Outgoing Senior TL cannot take this role while higher or equal-ranked direct reports remain assigned. Reassign those reports first.'
        ),
        { statusCode: 409 }
      );
    }
    await client.query(
      `UPDATE users SET role=$1,manager_id=$2,suspended=$3,updated_at=NOW()
       WHERE id=$4 AND deleted_at IS NULL`,
      [outgoingRole, replacementId, suspendOutgoing, outgoingLeadId]
    );
    await client.query(
      `UPDATE users SET role='SENIOR_TL',manager_id=NULL,updated_at=NOW()
       WHERE id=$1 AND deleted_at IS NULL`,
      [replacementId]
    );
    await client.query(
      `INSERT INTO audit_logs(user_id,action,resource_type,resource_id,details)
       VALUES($1,'DEPARTMENT_SENIOR_TL_HANDOVER','department',$2,$3)`,
      [
        actorId,
        departmentId,
        JSON.stringify({
          outgoingLeadId,
          replacementId,
          outgoingRole,
          suspendOutgoing,
          assignmentsMoved: 0,
        }),
      ]
    );
    await client.query('COMMIT');
    return {
      success: true,
      outgoingLeadId,
      replacementId,
      outgoingRole,
      outgoingSuspended: suspendOutgoing,
      assignmentsMoved: 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
module.exports = {
  createDepartment,
  getAll,
  getDepartmentTeams,
  deleteDepartment,
  handoverSeniorTl,
};
