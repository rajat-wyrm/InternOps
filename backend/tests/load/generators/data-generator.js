const departments = [
  'Engineering',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'Product',
  'Design',
  'Legal',
  'Data Science',
  'Quality Assurance',
  'DevOps',
  'Security',
  'Networking',
  'Database Administration',
  'Cloud Infrastructure',
  'Machine Learning',
  'Artificial Intelligence',
  'Blockchain',
  'IoT',
  'Embedded Systems',
  'Mobile Development',
  'Frontend Development',
  'Backend Development',
  'Full Stack Development',
];

const skills = [
  'JavaScript',
  'Python',
  'Java',
  'C++',
  'Go',
  'Rust',
  'TypeScript',
  'React',
  'Angular',
  'Vue.js',
  'Node.js',
  'Django',
  'Flask',
  'Spring Boot',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'MySQL',
  'DynamoDB',
  'Elasticsearch',
  'Docker',
  'Kubernetes',
  'Terraform',
  'Ansible',
  'AWS',
  'Azure',
  'GCP',
  'Git',
  'CI/CD',
  'Jenkins',
  'GitHub Actions',
  'CircleCI',
  'Linux',
  'Agile',
  'Scrum',
  'Project Management',
  'Communication',
  'Leadership',
  'SQL',
  'NoSQL',
  'GraphQL',
  'REST API',
  'gRPC',
  'WebSocket',
  'Machine Learning',
  'Deep Learning',
  'Data Analysis',
  'Statistics',
  'Network Security',
  'Penetration Testing',
  'Cryptography',
];

const statuses = [
  'active',
  'active',
  'active',
  'active',
  'inactive',
  'suspended',
];
const roles = ['intern', 'intern', 'intern', 'intern', 'mentor', 'admin'];
const genders = ['male', 'female', 'other'];
const attendanceStatuses = [
  'present',
  'present',
  'present',
  'present',
  'absent',
  'late',
  'half-day',
];
const progressStatuses = [
  'submitted',
  'submitted',
  'submitted',
  'approved',
  'approved',
  'pending_review',
  'revision_required',
];
const categories = [
  'GENERAL',
  'URGENT',
  'IMPORTANT',
  'INFO',
  'TASK',
  'EVENT',
  'ANNOUNCEMENT',
  'REMINDER',
];
const priorities = ['low', 'medium', 'medium', 'high', 'urgent'];
const platforms = ['web', 'web', 'web', 'mobile', 'mobile', 'api', 'system'];
const reportTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const fileFormats = ['csv', 'xlsx', 'pdf', 'json', 'html'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomArrayElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomArrayElements(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function randomPhone() {
  const code = randomInt(600, 999);
  const prefix = randomInt(100, 999);
  const suffix = randomInt(1000, 9999);
  return `+91-${code}${prefix}${suffix}`;
}

export function generateUser(overrides = {}) {
  const firstNames = [
    'Aarav',
    'Vivaan',
    'Aditya',
    'Vihaan',
    'Arjun',
    'Sai',
    'Reyansh',
    'Ayaan',
    'Krishna',
    'Ishaan',
    'Ananya',
    'Priya',
    'Neha',
    'Riya',
    'Meera',
    'Kavya',
    'Shreya',
    'Diya',
    'Aditi',
    'Sara',
    'Rahul',
    'Amit',
    'Vikram',
    'Suresh',
    'Deepak',
    'Manish',
    'Rajesh',
    'Sanjay',
    'Anil',
    'Vijay',
    'Pooja',
    'Sunita',
    'Lakshmi',
    'Geeta',
    'Rekha',
    'Anita',
    'Kavita',
    'Swati',
    'Divya',
    'Shweta',
    'James',
    'Maria',
    'Robert',
    'Linda',
    'Michael',
    'Jennifer',
    'David',
    'Susan',
    'Daniel',
    'Sarah',
    'Thomas',
    'Jessica',
    'Kevin',
    'Ashley',
    'Brandon',
    'Amanda',
    'Jason',
    'Nicole',
    'Ryan',
    'Stephanie',
    'Eric',
    'Megan',
    'Brian',
    'Lauren',
  ];
  const lastNames = [
    'Sharma',
    'Verma',
    'Patel',
    'Kumar',
    'Singh',
    'Reddy',
    'Gupta',
    'Joshi',
    'Nair',
    'Menon',
    'Das',
    'Bose',
    'Rao',
    'Prasad',
    'Agarwal',
    'Mehta',
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Wilson',
    'Moore',
    'Taylor',
    'Anderson',
    'Thomas',
    'Jackson',
    'White',
    'Harris',
  ];
  const firstName = overrides.firstName || randomArrayElement(firstNames);
  const lastName = overrides.lastName || randomArrayElement(lastNames);
  const timestamp =
    Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  return {
    firstName,
    lastName,
    email:
      overrides.email ||
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}_${timestamp}@loadtest.com`,
    password: overrides.password || 'LoadTest@123',
    role: overrides.role || randomArrayElement(roles),
    department: overrides.department || randomArrayElement(departments),
    gender: overrides.gender || randomArrayElement(genders),
    phone: overrides.phone || randomPhone(),
    dateOfBirth:
      overrides.dateOfBirth ||
      randomDate(new Date(1990, 0, 1), new Date(2005, 11, 31))
        .toISOString()
        .split('T')[0],
    address:
      overrides.address ||
      `${randomInt(1, 9999)}, Test Street, City-${randomInt(100000, 999999)}`,
    status: overrides.status || randomArrayElement(statuses),
    skills: overrides.skills || randomArrayElements(skills, randomInt(2, 8)),
    bio:
      overrides.bio ||
      `Experienced professional with background in ${randomArrayElement(departments)}.`,
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

export function generateBulkUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(generateUser({ role: 'intern' }));
  }
  return users;
}

export function generateIntern(overrides = {}) {
  const user = generateUser(overrides);
  return {
    ...user,
    internId:
      overrides.internId ||
      `INT${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`,
    startDate:
      overrides.startDate ||
      randomDate(new Date(2024, 0, 1), new Date(2026, 5, 30))
        .toISOString()
        .split('T')[0],
    endDate:
      overrides.endDate ||
      randomDate(new Date(2026, 6, 1), new Date(2027, 11, 31))
        .toISOString()
        .split('T')[0],
    mentorId: overrides.mentorId || null,
    project:
      overrides.project ||
      `Project ${randomArrayElement(['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Sigma', 'Lambda'])}`,
    university:
      overrides.university ||
      `University of ${randomArrayElement(['Technology', 'Science', 'Engineering', 'Innovation', 'Excellence'])}`,
    course:
      overrides.course ||
      `B.Tech in ${randomArrayElement(['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'])}`,
    year: overrides.year || randomInt(2, 4),
    cgpa: overrides.cgpa || parseFloat((randomInt(6, 10) / 10).toFixed(1)),
    attendancePercentage: overrides.attendancePercentage || randomInt(60, 100),
    skillsToLearn:
      overrides.skillsToLearn || randomArrayElements(skills, randomInt(2, 5)),
  };
}

export function generateBulkInterns(count) {
  const interns = [];
  for (let i = 0; i < count; i++) {
    interns.push(generateIntern());
  }
  return interns;
}

export function generateAttendanceRecord(overrides = {}) {
  const date =
    overrides.date || randomDate(new Date(2026, 0, 1), new Date(2026, 6, 1));
  return {
    internId: overrides.internId || `INT${randomInt(1000, 9999)}`,
    date: date.toISOString().split('T')[0],
    checkIn:
      overrides.checkIn ||
      `${String(randomInt(8, 10)).padStart(2, '0')}:${String(randomInt(0, 59)).padStart(2, '0')}:00`,
    checkOut:
      overrides.checkOut ||
      `${String(randomInt(16, 19)).padStart(2, '0')}:${String(randomInt(0, 59)).padStart(2, '0')}:00`,
    status: overrides.status || randomArrayElement(attendanceStatuses),
    notes: overrides.notes || '',
    workedHours:
      overrides.workedHours ||
      parseFloat((randomInt(4, 9) + Math.random()).toFixed(1)),
    overtime: overrides.overtime || parseFloat((Math.random() * 2).toFixed(1)),
    location:
      overrides.location ||
      `Office-${randomArrayElement(['A', 'B', 'C', 'D'])}`,
    markedBy: overrides.markedBy || null,
    taskSummary:
      overrides.taskSummary ||
      `Completed ${randomInt(3, 8)} tasks during the day.`,
  };
}

export function generateBulkAttendance(count) {
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push(generateAttendanceRecord());
  }
  return records;
}

export function generateProgressEntry(overrides = {}) {
  return {
    internId: overrides.internId || `INT${randomInt(1000, 9999)}`,
    date:
      overrides.date ||
      randomDate(new Date(2026, 0, 1), new Date(2026, 6, 1))
        .toISOString()
        .split('T')[0],
    tasksCompleted: overrides.tasksCompleted || randomInt(1, 10),
    tasksPlanned: overrides.tasksPlanned || randomInt(1, 10),
    hoursSpent:
      overrides.hoursSpent ||
      parseFloat((randomInt(4, 10) + Math.random()).toFixed(1)),
    description:
      overrides.description ||
      `Worked on ${randomArrayElement(['feature implementation', 'bug fixes', 'code review', 'documentation', 'testing', 'deployment', 'research', 'optimization'])}. Completed tasks: ${randomArrayElements(['API integration', 'UI updates', 'DB optimization', 'unit tests', 'code refactor', 'documentation', 'performance tuning', 'security audit'], randomInt(1, 5)).join(', ')}.`,
    blockers:
      overrides.blockers ||
      (Math.random() > 0.7
        ? `Waiting for ${randomArrayElement(['code review', 'design approval', 'API access', 'data migration', 'stakeholder feedback'])}.`
        : 'None'),
    status: overrides.status || randomArrayElement(progressStatuses),
    feedback: overrides.feedback || '',
    rating: overrides.rating || (Math.random() > 0.5 ? randomInt(1, 5) : null),
    attachments: overrides.attachments || [],
  };
}

export function generateBulkProgress(count) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push(generateProgressEntry());
  }
  return entries;
}

export function generateNotification(overrides = {}) {
  const types = ['info', 'warning', 'success', 'error', 'alert'];
  return {
    userId: overrides.userId || null,
    type: overrides.type || randomArrayElement(types),
    title:
      overrides.title ||
      `${randomArrayElement(['New', 'Updated', 'Pending', 'Completed', 'Urgent'])} ${randomArrayElement(['Task', 'Meeting', 'Deadline', 'Review', 'Approval', 'Update', 'Reminder', 'Alert'])}`,
    message:
      overrides.message ||
      `This is a ${randomArrayElement(['system', 'user', 'automated', 'scheduled'])} notification regarding ${randomArrayElement(['your account', 'a pending task', 'an upcoming deadline', 'a new assignment', 'a policy change', 'system maintenance', 'a team update', 'a performance review'])}.`,
    category: overrides.category || randomArrayElement(categories),
    priority: overrides.priority || randomArrayElement(priorities),
    link: overrides.link || null,
    read: overrides.read || Math.random() > 0.6,
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

export function generateBulkNotifications(count) {
  const notifications = [];
  for (let i = 0; i < count; i++) {
    notifications.push(generateNotification());
  }
  return notifications;
}

export function generateSession(overrides = {}) {
  const browserOptions = [
    'Chrome',
    'Firefox',
    'Safari',
    'Edge',
    'Brave',
    'Opera',
    'Vivaldi',
  ];
  const osOptions = [
    'Windows 10',
    'Windows 11',
    'macOS',
    'Linux',
    'iOS',
    'Android',
    'Chrome OS',
  ];
  const deviceOptions = [
    'Desktop',
    'Laptop',
    'Tablet',
    'Mobile',
    'Workstation',
  ];
  return {
    userId: overrides.userId || null,
    token:
      overrides.token ||
      `sess_${Array.from({ length: 48 }, () => Math.random().toString(36)[2]).join('')}`,
    ipAddress:
      overrides.ipAddress ||
      `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
    userAgent:
      overrides.userAgent ||
      `Mozilla/5.0 (${randomArrayElement(osOptions)}) ${randomArrayElement(browserOptions)}/${randomInt(90, 120)}.0`,
    device: overrides.device || randomArrayElement(deviceOptions),
    browser: overrides.browser || randomArrayElement(browserOptions),
    os: overrides.os || randomArrayElement(osOptions),
    location:
      overrides.location ||
      `${randomArrayElement(['New York', 'London', 'Tokyo', 'Mumbai', 'Berlin', 'Sydney', 'Toronto', 'Singapore', 'Dubai', 'Paris'])}, ${randomArrayElement(['US', 'UK', 'JP', 'IN', 'DE', 'AU', 'CA', 'SG', 'AE', 'FR'])}`,
    isActive: overrides.isActive || Math.random() > 0.3,
    lastActive: overrides.lastActive || new Date().toISOString(),
    createdAt:
      overrides.createdAt ||
      randomDate(new Date(2026, 5, 1), new Date(2026, 6, 1)).toISOString(),
    expiresAt:
      overrides.expiresAt ||
      randomDate(new Date(2026, 6, 1), new Date(2026, 7, 1)).toISOString(),
  };
}

export function generateDashboardMetrics(overrides = {}) {
  return {
    totalUsers: overrides.totalUsers || randomInt(100, 50000),
    activeUsers: overrides.activeUsers || randomInt(50, 25000),
    newUsersToday: overrides.newUsersToday || randomInt(1, 500),
    totalInterns: overrides.totalInterns || randomInt(50, 10000),
    activeInterns: overrides.activeInterns || randomInt(25, 5000),
    totalMentors: overrides.totalMentors || randomInt(10, 500),
    attendanceRate:
      overrides.attendanceRate ||
      parseFloat((randomInt(75, 99) + Math.random()).toFixed(1)),
    averageProductivity:
      overrides.averageProductivity ||
      parseFloat((randomInt(60, 98) + Math.random()).toFixed(1)),
    pendingReviews: overrides.pendingReviews || randomInt(0, 200),
    completedTasks: overrides.completedTasks || randomInt(100, 10000),
    overdueTasks: overrides.overdueTasks || randomInt(0, 100),
    averageResponseTime:
      overrides.averageResponseTime ||
      parseFloat((randomInt(100, 500) + Math.random()).toFixed(1)),
    serverUptime:
      overrides.serverUptime ||
      parseFloat((randomInt(99, 100) + Math.random()).toFixed(2)),
    apiRequestsToday: overrides.apiRequestsToday || randomInt(1000, 100000),
    errorRate:
      overrides.errorRate || parseFloat((Math.random() * 3).toFixed(2)),
    activeSessions: overrides.activeSessions || randomInt(10, 5000),
    storageUsed:
      overrides.storageUsed ||
      `${parseFloat((randomInt(1, 500) + Math.random()).toFixed(1))} GB`,
    bandwidthUsage:
      overrides.bandwidthUsage ||
      `${parseFloat((randomInt(10, 1000) + Math.random()).toFixed(1))} GB`,
    databaseConnections: overrides.databaseConnections || randomInt(5, 100),
    cacheHitRate:
      overrides.cacheHitRate ||
      parseFloat((randomInt(80, 99) + Math.random()).toFixed(1)),
  };
}

export function generateChartData(points, overrides = {}) {
  const data = [];
  const now = new Date();
  for (let i = 0; i < points; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (points - i));
    data.push({
      date: date.toISOString().split('T')[0],
      value: overrides.value || randomInt(100, 10000),
      metric:
        overrides.metric ||
        randomArrayElement([
          'users',
          'requests',
          'errors',
          'response_time',
          'throughput',
        ]),
      label: overrides.label || `Day ${i + 1}`,
      ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
    });
  }
  return data;
}

export function generatePerformanceMetrics(duration) {
  const metrics = [];
  const interval = 5;
  for (let t = 0; t < duration; t += interval) {
    metrics.push({
      timestamp: new Date(Date.now() - (duration - t) * 1000).toISOString(),
      elapsed: t,
      concurrentUsers: randomInt(10, 2000),
      requestsPerSecond: parseFloat(
        (randomInt(50, 500) + Math.random()).toFixed(1)
      ),
      averageLatency: parseFloat(
        (randomInt(50, 2000) + Math.random()).toFixed(1)
      ),
      p95Latency: parseFloat((randomInt(100, 4000) + Math.random()).toFixed(1)),
      p99Latency: parseFloat((randomInt(200, 8000) + Math.random()).toFixed(1)),
      errorRate: parseFloat((Math.random() * 10).toFixed(2)),
      throughput: parseFloat((randomInt(100, 5000) + Math.random()).toFixed(1)),
      cpuUsage: parseFloat((randomInt(20, 95) + Math.random()).toFixed(1)),
      memoryUsage: parseFloat((randomInt(30, 90) + Math.random()).toFixed(1)),
      diskIO: parseFloat((randomInt(10, 500) + Math.random()).toFixed(1)),
      networkIn: parseFloat((randomInt(1, 100) + Math.random()).toFixed(1)),
      networkOut: parseFloat((randomInt(1, 100) + Math.random()).toFixed(1)),
      activeDbConnections: randomInt(5, 80),
      dbQueryTime: parseFloat((randomInt(5, 500) + Math.random()).toFixed(1)),
    });
  }
  return metrics;
}

export function generateTestPlan() {
  const testScenarios = [];
  const scenarioTypes = [
    {
      name: 'Authentication Load Test',
      users: 2000,
      duration: 30,
      endpoint: '/api/v1/auth/login',
    },
    {
      name: 'Intern CRUD Operations',
      users: 1500,
      duration: 45,
      endpoint: '/api/v1/interns',
    },
    {
      name: 'Attendance Bulk Marking',
      users: 1000,
      duration: 30,
      endpoint: '/api/v1/attendance/bulk',
    },
    {
      name: 'Dashboard Analytics',
      users: 500,
      duration: 20,
      endpoint: '/api/v1/dashboard/analytics',
    },
    {
      name: 'Report Generation',
      users: 300,
      duration: 60,
      endpoint: '/api/v1/reports/generate',
    },
    {
      name: 'Notification Push',
      users: 800,
      duration: 25,
      endpoint: '/api/v1/notifications',
    },
    {
      name: 'Mentor Assignment',
      users: 400,
      duration: 15,
      endpoint: '/api/v1/mentors/assign',
    },
    {
      name: 'Progress Submission',
      users: 1200,
      duration: 40,
      endpoint: '/api/v1/progress',
    },
    {
      name: 'Export Operations',
      users: 200,
      duration: 30,
      endpoint: '/api/v1/exports/csv',
    },
    {
      name: 'Session Management',
      users: 600,
      duration: 20,
      endpoint: '/api/v1/sessions',
    },
    {
      name: 'Search and Filter',
      users: 1000,
      duration: 25,
      endpoint: '/api/v1/interns/search',
    },
    {
      name: 'Admin Operations',
      users: 100,
      duration: 30,
      endpoint: '/api/v1/admin/users',
    },
  ];
  for (const scenario of scenarioTypes) {
    testScenarios.push({
      ...scenario,
      thresholds: {
        p95: randomInt(200, 1500),
        p99: randomInt(500, 3000),
        errorRate: parseFloat((Math.random() * 5).toFixed(2)),
      },
      description: `Simulate ${scenario.users} concurrent users accessing ${scenario.name} for ${scenario.duration} minutes.`,
    });
  }
  return testScenarios;
}
