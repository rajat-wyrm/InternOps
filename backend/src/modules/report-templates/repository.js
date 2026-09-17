const pool = require('../../config/db');

async function createTemplate({
  name,
  description,
  createdBy,
  departmentId,
  visibility,
  isDefault,
  configuration,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // If this template becomes the default, remove the
    // previous default from the same scope.
    if (isDefault) {
      if (departmentId) {
        await client.query(
          `
          UPDATE report_templates
          SET is_default = FALSE,
              updated_at = NOW()
          WHERE department_id = $1
            AND is_default = TRUE
            AND deleted_at IS NULL
          `,
          [departmentId]
        );
      } else {
        await client.query(
          `
          UPDATE report_templates
          SET is_default = FALSE,
              updated_at = NOW()
          WHERE department_id IS NULL
            AND is_default = TRUE
            AND deleted_at IS NULL
          `
        );
      }
    }

    const result = await client.query(
      `
      INSERT INTO report_templates (
        name,
        description,
        created_by,
        department_id,
        visibility,
        is_default,
        configuration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
      `,
      [
        name,
        description || null,
        createdBy,
        departmentId || null,
        visibility,
        isDefault,
        JSON.stringify(configuration || {}),
      ]
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getAll({ departmentId = null, visibility = null } = {}) {
  const params = [];
  const conditions = ['rt.deleted_at IS NULL'];

  if (departmentId) {
    params.push(departmentId);
    conditions.push(
      `(rt.department_id = $${params.length} OR rt.department_id IS NULL)`
    );
  }

  if (visibility) {
    params.push(visibility);
    conditions.push(`rt.visibility = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      rt.*,
      u.full_name AS created_by_name
    FROM report_templates rt
    LEFT JOIN users u
      ON u.id = rt.created_by
    WHERE ${conditions.join(' AND ')}
    ORDER BY rt.is_default DESC, rt.created_at DESC
    `,
    params
  );

  return result.rows;
}

async function getById(id) {
  const result = await pool.query(
    `
    SELECT
      rt.*,
      u.full_name AS created_by_name
    FROM report_templates rt
    LEFT JOIN users u
      ON u.id = rt.created_by
    WHERE rt.id = $1
      AND rt.deleted_at IS NULL
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateTemplate(
  id,
  { name, description, departmentId, visibility, isDefault, configuration }
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (isDefault === true) {
      if (departmentId) {
        await client.query(
          `
          UPDATE report_templates
          SET is_default = FALSE,
              updated_at = NOW()
          WHERE department_id = $1
            AND id <> $2
            AND is_default = TRUE
            AND deleted_at IS NULL
          `,
          [departmentId, id]
        );
      } else {
        await client.query(
          `
          UPDATE report_templates
          SET is_default = FALSE,
              updated_at = NOW()
          WHERE department_id IS NULL
            AND id <> $1
            AND is_default = TRUE
            AND deleted_at IS NULL
          `,
          [id]
        );
      }
    }

    const result = await client.query(
      `
      UPDATE report_templates
      SET
        name = $1,
        description = $2,
        department_id = $3,
        visibility = $4,
        is_default = $5,
        configuration = $6::jsonb,
        updated_at = NOW()
      WHERE id = $7
        AND deleted_at IS NULL
      RETURNING *
      `,
      [
        name,
        description || null,
        departmentId || null,
        visibility,
        isDefault,
        JSON.stringify(configuration || {}),
        id,
      ]
    );

    await client.query('COMMIT');

    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteTemplate(id) {
  const result = await pool.query(
    `
    UPDATE report_templates
    SET deleted_at = NOW(),
        updated_at = NOW(),
        is_default = FALSE
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getVersions(templateId) {
  const result = await pool.query(
    `
    SELECT
      rtv.*,
      u.full_name AS created_by_name
    FROM report_template_versions rtv
    LEFT JOIN users u
      ON u.id = rtv.created_by
    WHERE rtv.template_id = $1
    ORDER BY rtv.version_number DESC
    `,
    [templateId]
  );

  return result.rows;
}

async function getNextVersionNumber(templateId) {
  const result = await pool.query(
    `
    SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
    FROM report_template_versions
    WHERE template_id = $1
    `,
    [templateId]
  );

  return Number(result.rows[0].next_version);
}

async function createVersion({
  templateId,
  versionNumber,
  configuration,
  createdBy,
}) {
  const result = await pool.query(
    `
    INSERT INTO report_template_versions (
      template_id,
      version_number,
      configuration,
      created_by
    )
    VALUES ($1, $2, $3::jsonb, $4)
    RETURNING *
    `,
    [templateId, versionNumber, JSON.stringify(configuration || {}), createdBy]
  );

  return result.rows[0];
}

module.exports = {
  createTemplate,
  getAll,
  getById,
  updateTemplate,
  deleteTemplate,
  getVersions,
  getNextVersionNumber,
  createVersion,
};
