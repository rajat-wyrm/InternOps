const repo = require('./repository');
const { MAX_HIERARCHY_ROWS } = require('../../utils/hierarchy');

function normalizeHierarchyLimit(limit) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return MAX_HIERARCHY_ROWS;
  }

  return Math.min(Math.trunc(parsed), MAX_HIERARCHY_ROWS);
}

async function getDepartmentTeams(departmentId, options = {}) {
  return repo.getDepartmentTeams(departmentId, {
    hierarchyLimit: normalizeHierarchyLimit(options.hierarchyLimit),
  });
}
async function handoverSeniorTl(data) {
  return repo.handoverSeniorTl(
    data.departmentId,
    data.outgoingLeadId,
    data.replacementId,
    data.outgoingRole,
    data.actorId,
    data.suspendOutgoing
  );
}
module.exports = {
  getDepartmentTeams,
  handoverSeniorTl,
  normalizeHierarchyLimit,
};
