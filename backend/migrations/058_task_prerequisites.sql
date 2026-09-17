-- Migration: 054_task_prerequisites
-- Adds a junction table that models prerequisite relationships between tasks.
-- The application layer enforces that this graph remains a DAG (no cycles)
-- using DFS-based validation before every INSERT. The DB constraint below
-- provides a last-resort guard against direct self-loops only.

CREATE TABLE IF NOT EXISTS task_prerequisites (
  task_id    UUID NOT NULL REFERENCES social_tasks(id) ON DELETE CASCADE,
  prereq_id  UUID NOT NULL REFERENCES social_tasks(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (task_id, prereq_id),

  -- Database-level guard: a task cannot declare itself as its own prerequisite.
  -- Longer cycles (A→B→A) are prevented by the application-layer DFS check.
  CONSTRAINT task_prereq_no_self_loop CHECK (task_id <> prereq_id)
);

CREATE INDEX IF NOT EXISTS idx_task_prerequisites_task_id
  ON task_prerequisites(task_id);

CREATE INDEX IF NOT EXISTS idx_task_prerequisites_prereq_id
  ON task_prerequisites(prereq_id);