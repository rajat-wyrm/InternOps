const pool = require('../../config/db');

/**
 * Create a reusable onboarding template with its items.
 */
async function createTemplate({
  title,
  role,
  departmentId,
  createdBy,
  items = [],
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const templateResult = await client.query(
      `
        INSERT INTO onboarding_templates (
          title,
          role,
          department_id,
          created_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [title, role, departmentId || null, createdBy]
    );

    const template = templateResult.rows[0];
    const savedItems = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];

      const itemResult = await client.query(
        `
          INSERT INTO onboarding_template_items (
            template_id,
            title,
            description,
            due_day_offset,
            social_task_id,
            position
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          template.id,
          item.title,
          item.description || null,
          item.dueDayOffset ?? null,
          item.socialTaskId || null,
          i,
        ]
      );

      savedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...template,
      items: savedItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find a reusable template for a role/department.
 */
async function findTemplate(role, departmentId) {
  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_templates
      WHERE role = $1
        AND (
          department_id = $2
          OR department_id IS NULL
        )
        AND deleted_at IS NULL
      ORDER BY
        CASE
          WHEN department_id = $2 THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
    `,
    [role, departmentId || null]
  );

  if (!result.rows[0]) {
    return null;
  }

  const template = result.rows[0];

  const itemsResult = await pool.query(
    `
      SELECT *
      FROM onboarding_template_items
      WHERE template_id = $1
      ORDER BY position ASC, created_at ASC
    `,
    [template.id]
  );

  return {
    ...template,
    items: itemsResult.rows,
  };
}

/**
 * Get a template by id.
 */
async function getTemplateById(templateId) {
  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_templates
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [templateId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const template = result.rows[0];

  const itemsResult = await pool.query(
    `
      SELECT *
      FROM onboarding_template_items
      WHERE template_id = $1
      ORDER BY position ASC, created_at ASC
    `,
    [templateId]
  );

  return {
    ...template,
    items: itemsResult.rows,
  };
}

/**
 * Attach an editable checklist to an intern.
 */
async function createChecklist({
  internId,
  templateId = null,
  title,
  role,
  departmentId,
  assignedBy,
  items = [],
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checklistResult = await client.query(
      `
        INSERT INTO onboarding_checklists (
          intern_id,
          template_id,
          title,
          role,
          department_id,
          assigned_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [internId, templateId, title, role, departmentId || null, assignedBy]
    );

    const checklist = checklistResult.rows[0];
    const savedItems = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];

      const itemResult = await client.query(
        `
          INSERT INTO onboarding_checklist_items (
            checklist_id,
            title,
            description,
            due_day_offset,
            social_task_id,
            position
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          checklist.id,
          item.title,
          item.description || null,
          item.dueDayOffset ?? item.due_day_offset ?? null,
          item.socialTaskId || item.social_task_id || null,
          i,
        ]
      );

      savedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...checklist,
      items: savedItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get checklist by id.
 *
 * Includes intern information so the route can determine whether
 * the requester is the intern or their direct manager.
 */
async function getChecklistById(checklistId) {
  const result = await pool.query(
    `
      SELECT
        c.*,
        u.manager_id
      FROM onboarding_checklists c
      JOIN users u
        ON u.id = c.intern_id
      WHERE c.id = $1
        AND c.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [checklistId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const checklist = result.rows[0];

  const itemsResult = await pool.query(
    `
      SELECT *
      FROM onboarding_checklist_items
      WHERE checklist_id = $1
      ORDER BY position ASC, created_at ASC
    `,
    [checklistId]
  );

  return {
    ...checklist,
    items: itemsResult.rows,
  };
}

/**
 * Get active onboarding checklists belonging to an intern.
 */
async function getChecklistsForIntern(internId) {
  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_checklists
      WHERE intern_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
    [internId]
  );

  const checklists = [];

  for (const checklist of result.rows) {
    const itemsResult = await pool.query(
      `
        SELECT *
        FROM onboarding_checklist_items
        WHERE checklist_id = $1
        ORDER BY position ASC, created_at ASC
      `,
      [checklist.id]
    );

    checklists.push({
      ...checklist,
      items: itemsResult.rows,
    });
  }

  return checklists;
}

/**
 * Update completion state of a checklist item.
 */
async function updateChecklistItemCompletion({
  itemId,
  checklistId,
  completed,
}) {
  const result = await pool.query(
    `
      UPDATE onboarding_checklist_items
      SET
        completed = $1,
        completed_at = CASE
          WHEN $1 = TRUE THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = $2
        AND checklist_id = $3
      RETURNING *
    `,
    [completed, itemId, checklistId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createTemplate,
  findTemplate,
  getTemplateById,
  createChecklist,
  getChecklistById,
  getChecklistsForIntern,
  updateChecklistItemCompletion,
};
