-- Reusable onboarding checklist templates
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_role
  ON onboarding_templates(role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_department
  ON onboarding_templates(department_id)
  WHERE deleted_at IS NULL;


-- Items belonging to reusable templates
CREATE TABLE IF NOT EXISTS onboarding_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL
    REFERENCES onboarding_templates(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_day_offset INTEGER,

  -- Optional reference to an existing social task.
  -- This avoids duplicating social_tasks.
  social_task_id UUID
    REFERENCES social_tasks(id) ON DELETE SET NULL,

  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (due_day_offset IS NULL OR due_day_offset >= 0)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_template_items_template
  ON onboarding_template_items(template_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_template_items_social_task
  ON onboarding_template_items(social_task_id);


-- Checklist attached to a specific intern
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Keep the template reference when the checklist originated
  -- from a reusable template.
  template_id UUID
    REFERENCES onboarding_templates(id) ON DELETE SET NULL,

  title VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_intern
  ON onboarding_checklists(intern_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_template
  ON onboarding_checklists(template_id)
  WHERE deleted_at IS NULL;


-- Editable checklist items for a specific intern
CREATE TABLE IF NOT EXISTS onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  checklist_id UUID NOT NULL
    REFERENCES onboarding_checklists(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_day_offset INTEGER,

  social_task_id UUID
    REFERENCES social_tasks(id) ON DELETE SET NULL,

  position INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (due_day_offset IS NULL OR due_day_offset >= 0)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_items_checklist
  ON onboarding_checklist_items(checklist_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_items_social_task
  ON onboarding_checklist_items(social_task_id);