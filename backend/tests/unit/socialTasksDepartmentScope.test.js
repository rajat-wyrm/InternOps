const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Social Tasks department scope contract', () => {
  const migration = read('backend/migrations/053_social_tasks_department.sql');
  const routes = read('backend/src/modules/social-tasks/routes.js');
  const repository = read('backend/src/modules/social-tasks/repository.js');
  const tasksPage = read('frontend/src/pages/Tasks.jsx');
  const createForm = read('frontend/src/components/CreateTaskForm.jsx');

  it('adds an indexed nullable department foreign key with safe deletion', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS department_id UUID');
    expect(migration).toContain('REFERENCES departments(id)');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).toContain('idx_social_tasks_department_id');
  });

  it('validates the department and persists explicit task scope', () => {
    expect(routes).toContain('department_id: z.string().uuid().optional()');
    expect(routes).toContain('getActiveDepartmentById');
    expect(routes).toContain('data.department_id');
    expect(routes).toContain("error: 'Selected department is not available'");
    expect(repository).toContain('departmentId || null');
    expect(repository).toContain('st.department_id = $${pIdx}::uuid');
    expect(repository).toContain('st.department_id IS NULL');
  });

  it('forwards department context and invalidates the exact task query', () => {
    expect(tasksPage).toContain(
      '<CreateTaskForm departmentId={activeDeptId || undefined} />'
    );
    expect(createForm).toContain(
      '...(departmentId ? { department_id: departmentId } : {})'
    );
    expect(createForm).toContain("queryKey: ['tasks', departmentId || '']");
  });
});
