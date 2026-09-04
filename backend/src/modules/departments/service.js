const repo = require('./repository');
async function getDepartmentTeams(departmentId) {
  return repo.getDepartmentTeams(departmentId);
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
module.exports = { getDepartmentTeams, handoverSeniorTl };
