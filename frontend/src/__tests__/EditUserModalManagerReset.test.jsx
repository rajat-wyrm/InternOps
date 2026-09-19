import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) =>
  fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('EditUserModal manager selection contract', () => {
  it('clears managerId whenever the role changes', () => {
    const modal = read('src/components/admin/EditUserModal.jsx');

    expect(modal).toContain("const [managerId, setManagerId] = useState('');");

    expect(modal).toContain('setRole(v);');
    expect(modal).toContain("setManagerId('');");

    const roleChangeHandler = modal.match(
      /onChange=\{\(v\) => \{[\s\S]*?setInternSearch\(''\);[\s\S]*?\}\}/
    );

    expect(roleChangeHandler).not.toBeNull();
    expect(roleChangeHandler[0]).toContain('setRole(v);');
    expect(roleChangeHandler[0]).toContain("setManagerId('');");
  });
});
