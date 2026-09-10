const config = require('../../config');

async function uptoskillsRequest(endpoint) {
  if (!config.uptoskills.baseUrl) {
    return {
      configured: false,
      message: 'UptoSkills API URL is not configured',
    };
  }

  const response = await fetch(`${config.uptoskills.baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.uptoskills.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `UptoSkills API request failed with status ${response.status}`
    );
  }

  return response.json();
}

async function getInternsFromUptoskills() {
  return uptoskillsRequest('/interns');
}

async function getDepartmentsFromUptoskills() {
  return uptoskillsRequest('/departments');
}

async function syncUsers() {
  const interns = await getInternsFromUptoskills();

  return {
    success: true,
    data: interns,
  };
}

async function syncAttendance() {
  return {
    success: false,
    message: 'Attendance sync endpoint is not configured',
  };
}

async function syncProjects() {
  return {
    success: false,
    message: 'Project sync endpoint is not configured',
  };
}

async function getSyncStatus() {
  return {
    configured: Boolean(config.uptoskills.baseUrl),
    status: config.uptoskills.baseUrl ? 'ready' : 'not_configured',
  };
}

module.exports = {
  getInternsFromUptoskills,
  getDepartmentsFromUptoskills,
  syncUsers,
  syncAttendance,
  syncProjects,
  getSyncStatus,
};
