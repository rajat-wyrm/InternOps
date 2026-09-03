-- 037_report_templates.sql
-- Report Template Management

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    created_by UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    department_id UUID
        REFERENCES departments(id) ON DELETE SET NULL,

    visibility VARCHAR(30) NOT NULL DEFAULT 'PRIVATE'
        CHECK (visibility IN ('PRIVATE', 'TEAM', 'ORGANIZATION')),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_templates_created_by
    ON report_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_report_templates_department
    ON report_templates(department_id);

CREATE INDEX IF NOT EXISTS idx_report_templates_visibility
    ON report_templates(visibility);

CREATE INDEX IF NOT EXISTS idx_report_templates_active
    ON report_templates(deleted_at);


CREATE TABLE IF NOT EXISTS report_template_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    template_id UUID NOT NULL
        REFERENCES report_templates(id) ON DELETE CASCADE,

    version_number INTEGER NOT NULL,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT report_template_versions_unique_version
        UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_report_template_versions_template
    ON report_template_versions(template_id);

CREATE INDEX IF NOT EXISTS idx_report_template_versions_created_by
    ON report_template_versions(created_by);


-- Only one active default template per department.
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_templates_default_department
    ON report_templates(department_id)
    WHERE is_default = TRUE
      AND deleted_at IS NULL
      AND department_id IS NOT NULL;


-- Only one active organization-wide default template.
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_templates_default_org
    ON report_templates(is_default)
    WHERE is_default = TRUE
      AND deleted_at IS NULL
      AND department_id IS NULL;


COMMENT ON TABLE report_templates IS
    'Reusable report templates and their current configuration';

COMMENT ON TABLE report_template_versions IS
    'Historical versions of report template configurations';

COMMENT ON COLUMN report_templates.configuration IS
    'JSON configuration containing layout, columns, filters, date range and department settings';
