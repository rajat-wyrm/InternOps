const ROLE_ROWS = {
  ADMIN: [
    ['SENIOR_TL', 'TL'],
    ['CAPTAIN', 'INTERN'],
  ],
  SENIOR_TL: [['TL', 'CAPTAIN'], ['INTERN']],
  TL: [['CAPTAIN', 'INTERN']],
  CAPTAIN: [['INTERN']],
};

const ROLE_LABELS = {
  SENIOR_TL: ['Senior TL', 'Senior TLs'],
  TL: ['TL', 'TLs'],
  CAPTAIN: ['Captain', 'Captains'],
  INTERN: ['Intern', 'Interns'],
};

export function getTeamRoleBreakdown(role, members = []) {
  if (members.length === 0) return [];

  return (ROLE_ROWS[role] || []).map((row) =>
    row.map((memberRole) => {
      const count = members.filter(
        (member) => member.role === memberRole
      ).length;
      const [singular, plural] = ROLE_LABELS[memberRole];
      return {
        role: memberRole,
        count,
        label: count === 1 ? singular : plural,
      };
    })
  );
}
