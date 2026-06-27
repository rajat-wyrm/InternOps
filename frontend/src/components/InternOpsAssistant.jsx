import { useState, useRef, useEffect } from 'react';
import api from '../lib/axios';
import CustomSelect from './CustomSelect';

const ROLES = ['Admin', 'Senior TL', 'TL', 'Captain', 'Intern'];

const ROLE_OPTIONS = ROLES.map((role) => ({
  value: role,
  label: role,
}));

const ROLE_PERMISSIONS = {
  Admin: {
    canDo: [
      'Mark attendance (single & bulk)',
      'Submit & view ratings',
      'Create social tasks',
      'Verify proofs',
      'View all reports & analytics',
      'Manage sessions',
      'View audit logs',
      'Schedule meetings',
      'Manage all users',
    ],
    cannotDo: ['Nothing — full access to all resources'],
  },
  'Senior TL': {
    canDo: [
      'Manage TLs, Captains, Interns',
      'Create social tasks',
      'Verify proofs',
      'View department reports',
      'Mark attendance for team',
      'Submit ratings to TLs',
    ],
    cannotDo: [
      'Access other departments',
      'View audit logs',
      'Revoke admin sessions',
    ],
  },
  TL: {
    canDo: [
      'Manage Captains and Interns',
      'Submit ratings to Captains',
      'Mark attendance',
      'Verify proofs',
      'Schedule team meetings',
    ],
    cannotDo: [
      'Create social tasks',
      'View admin-level reports',
      "Access Senior TL's team data",
    ],
  },
  Captain: {
    canDo: [
      'Manage Interns directly',
      'Submit ratings to Interns',
      'Verify proof submissions',
      'Mark intern attendance',
    ],
    cannotDo: [
      'Create social tasks',
      'View TL-level reports',
      "Access other captains' interns",
    ],
  },
  Intern: {
    canDo: [
      'View own attendance',
      'View own ratings history',
      'Upload proof submissions',
      'View own notifications',
      'Attend meetings',
    ],
    cannotDo: [
      'Submit ratings',
      'Create tasks',
      "View other users' data",
      'Access reports',
    ],
  },
};

const QUICK_FAQS = [
  {
    q: 'What is UptoSkills?',
    a: "UptoSkills (est. 2018, Delhi) is India's AI-powered platform connecting Candidates, Colleges & Corporates. It offers gamified learning, smart assessments, hackathons, job/internship matching, AI Practice Hub, and Aura Rewards — all in one place.",
  },
  {
    q: 'What features does UptoSkills offer?',
    a: 'UptoSkills offers: AI-personalized learning, hackathons (UptoHacks), job & internship matching, leagues & competitions, AI Practice Hub, smart assessments, Aura Rewards, certificates, Refer & Earn, and a mobile app on Play Store.',
  },
  {
    q: 'How does the rating system work?',
    a: 'Ratings are **permanent and immutable** — each rating is stored as a new row in the database. You can only rate someone who is directly below you in the hierarchy chain. For example, a TL can rate Captains, and a Captain can rate Interns.',
  },
  {
    q: 'What happens to proof images after verification?',
    a: 'After a proof is verified by a Captain, TL, or Senior TL, the image file is **automatically deleted after 24 hours** via a scheduled cron job. This keeps storage clean and protects privacy.',
  },
  {
    q: 'How does attendance marking work?',
    a: 'Attendance supports both **single and bulk marking** with optional remarks. Records are immutable — if an update is needed, a new record is created and the change is logged in the audit trail.',
  },
  {
    q: 'What is session management?',
    a: 'You can view all your active sessions, revoke individual sessions (to log out a specific device), or revoke all sessions at once. Admins can force-revoke sessions for any user.',
  },
  {
    q: 'How does the hierarchy model work?',
    a: 'There are 5 tiers: **Admin → Senior TL → TL → Captain → Intern**. Ownership is validated recursively using a SQL recursive CTE that walks the manager chain, so you can only access data within your hierarchy branch.',
  },
  {
    q: 'What is logged in the audit trail?',
    a: 'Every sensitive action is logged: who did it (actor), what action (e.g. USER_CREATED, ATTENDANCE_MARKED), the resource type & ID, old & new values as JSON, IP address, user agent, and timestamp.',
  },
];

const QUICK_ACTIONS = [
  { label: 'About UptoSkills', prompt: 'What is UptoSkills?' },
  { label: 'Submit rating', prompt: 'How do I submit a rating?' },
  { label: 'Create task', prompt: 'How do I create a social task?' },
  { label: 'Upload proof', prompt: 'How do I upload proof for a task?' },
  { label: 'Verify task', prompt: 'How do I verify a proof submission?' },
  { label: 'Attendance', prompt: 'How do I mark attendance?' },
];

const CONTEXT_BUTTONS = [
  { label: 'About UptoSkills', prompt: 'What is UptoSkills?' },
  { label: 'Submit a rating', prompt: 'How do I submit a rating?' },
  { label: 'Create a social task', prompt: 'How do I create a social task?' },
  { label: 'Mark attendance', prompt: 'How do I mark attendance?' },
  { label: 'View reports', prompt: 'How do I view reports and analytics?' },
];

const KB = {
  uptoskills: `**About UptoSkills 🚀**\n\n**"Let's Make Freshers Employable!"**\n\nUptoSkills is India's **AI-powered ecosystem** connecting **Candidates, Colleges & Corporates** on a single unified platform.\n\n🏢 **Company Details:**\n- Founded: 2018 | Headquarters: Delhi, India\n- Type: Private Company | Size: 11–50 employees\n- Associated Members: 1232+\n\n🎯 **Core Mission:**\nBridge the critical skills gap — transform unemployable graduates into industry-ready talent and make hiring seamless, efficient, and data-driven.\n\n⚙️ **What We Offer:**\n- 🎮 Gamified & AI-Personalized Learning\n- 🧠 Smart Assessments & AI Mock Interviews\n- 🏆 Hackathons & Corporate Events (UptoHacks 2026)\n- 💼 Direct Job & Internship Matching\n- 🏅 Leagues, Aura Rewards & Competitions\n- 📜 Certificates & Academic Tracking\n- 🤖 AI Practice Hub\n- 🔁 Refer & Earn Program\n- 📱 UptoSkills App (now live on Play Store!)\n\n🌐 Visit: uptoskills.com`,
  platform: `**UptoSkills Platform Features:**\n\n**Student Dashboard includes:**\n- 🏆 My Competitions — register & track hackathons\n- 💼 My Jobs — browse & apply for openings\n- 🎓 My Internships — find & manage internships\n- 🤖 AI Practice Hub — mock interviews & assessments\n- 🏅 My Leagues — compete in skill leagues\n- 📅 My Events — webinars & corporate events\n- ⭐ Aura Rewards — earn points for activities\n- 🎓 Academics — track academic progress\n- 📜 My Certificates — view earned certificates\n- 🏆 Awards — achievements & recognition\n- 💳 Subscription — manage your plan\n- 🔁 Refer & Earn — invite friends & earn rewards\n\n**Quick Actions available:**\n- Refer and Earn\n- Intern at UptoSkills\n- Blog Shorts\n- Guides and FAQs`,
  rating: `**Submitting a Rating:**\n\n1. Navigate to the Ratings section.\n2. Select the team member you want to rate (must be directly below you in the hierarchy).\n3. Enter a score and optional remarks.\n4. Submit — ratings are permanent and cannot be edited.\n\n> ⚠️ Only direct managers can rate their reports. A TL cannot skip-level rate an Intern.`,
  task: `**Creating a Social Task:**\n\n1. Go to Tasks → Create Task (Admin / Senior TL only).\n2. Set a title, description, and deadline.\n3. Assign to relevant interns or teams.\n4. Interns will receive a notification and can upload proof.\n5. Captains/TLs verify the submissions.\n\n> 📸 Verified proof images are auto-deleted after 24 hours.`,
  proof: `**Uploading Proof for a Task:**\n\n1. Open the task assigned to you.\n2. Click **Upload Proof** and select a screenshot or image.\n3. The file is submitted for verification.\n4. You'll receive a notification once verified.\n\n> Only Interns can submit proofs. Supported formats: JPG, PNG.`,
  verify: `**Verifying a Proof Submission:**\n\n1. Go to Proofs section (Captain, TL, Senior TL, Admin).\n2. Review the submitted screenshot.\n3. Click **Verify** to approve or **Reject** with a reason.\n4. The intern receives a notification on the outcome.\n\n> ✅ Once verified, the image is scheduled for deletion in 24 hours.`,
  attendance: `**Marking Attendance:**\n\n1. Go to Attendance → Mark Attendance.\n2. Select the team member(s) — use **Bulk Mark** for multiple.\n3. Choose status: Present / Absent / Late / Half Day.\n4. Add optional remarks and submit.\n\n> 📋 Attendance records are immutable. Changes create new records with an audit log entry.`,
  reports: `**Viewing Reports & Analytics:**\n\n- **Attendance Summary** — aggregated counts by role/status for a date range.\n- **Rating Summary** — average scores and totals per role.\n- **Task Completion** — verified vs pending counts per task.\n- **Top Performers** — interns ranked by average rating.\n- **Attendance Trends** — monthly distribution for past N months.\n- **CSV Exports** — download attendance, ratings, or task data.\n\n> Available at \`/api/analytics\` and \`/api/reports\`. Admin & Senior TL have full access.`,
  sessions: `**Managing Sessions:**\n\n1. Go to Sessions from your profile menu.\n2. View all active devices/sessions.\n3. Click **Revoke** next to a session to log out that device.\n4. Use **Revoke All** to log out all devices (except current).\n\n> Admins can force-revoke sessions for any user from the admin panel.`,
  meetings: `**Scheduling Meetings:**\n\n1. Go to Meetings → Schedule Meeting.\n2. Set date, time, and description.\n3. Add attendees from your team.\n4. All attendees receive a notification.\n\n> Visibility is restricted — you can only see meetings where you're the creator, an attendee, or a manager in the hierarchy.`,
  hierarchy: `**Hierarchy Model:**\n\n\`\`\`\nAdmin\n  └── Senior TL\n        └── TL\n              └── Captain\n                    └── Intern\n\`\`\`\n\nOwnership is validated recursively using a SQL \`WITH RECURSIVE\` CTE. Each role can only access data within their own branch of the hierarchy tree.`,
  audit: `**Audit Logs:**\n\nEvery sensitive action is logged with:\n- Actor (user ID)\n- Action type (e.g. \`USER_CREATED\`, \`ATTENDANCE_MARKED\`)\n- Resource type & ID\n- Old and new values (JSON)\n- IP address & user agent\n- Timestamp\n\n> Audit logs are **immutable** and accessible only by Admins at \`/api/audit\`.`,
};

function getKBResponse(text) {
  const t = text.toLowerCase();

  // UptoSkills info — check first
  if (
    t.includes('uptoskills') ||
    t.includes('upskill') ||
    t.includes('about this platform') ||
    t.includes('about the platform') ||
    t.includes('what is this') ||
    t.includes('who made') ||
    t.includes('company info') ||
    t.includes('about us') ||
    t.includes('what is uptoskills')
  ) {
    return KB.uptoskills;
  }

  if (
    t.includes('dashboard') ||
    t.includes('aura') ||
    t.includes('leagues') ||
    t.includes('hackathon') ||
    t.includes('competitions') ||
    t.includes('platform features') ||
    t.includes('what can i find')
  ) {
    return KB.platform;
  }

  if (t.includes('rating') || t.includes('rate')) return KB.rating;
  if (t.includes('social task') || t.includes('create task')) return KB.task;
  if (t.includes('upload proof') || t.includes('proof')) return KB.proof;
  if (t.includes('verify') || t.includes('verification')) return KB.verify;
  if (t.includes('attendance') || t.includes('mark')) return KB.attendance;
  if (t.includes('report') || t.includes('analytics')) return KB.reports;
  if (t.includes('session')) return KB.sessions;
  if (t.includes('meeting')) return KB.meetings;
  if (
    t.includes('hierarchy') ||
    t.includes('role') ||
    t.includes('permission')
  ) {
    return KB.hierarchy;
  }
  if (t.includes('audit') || t.includes('log')) return KB.audit;

  return null;
}

function parseBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold text-slate-900 dark:text-white">
        {p}
      </strong>
    ) : (
      p
    )
  );
}

function renderMarkdown(text) {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    if (line.startsWith('### ')) {
      return (
        <h3
          key={i}
          className="font-extrabold text-sm mt-3 mb-1 text-slate-900 dark:text-white"
        >
          {line.slice(4)}
        </h3>
      );
    }

    if (line.startsWith('## ')) {
      return (
        <h2
          key={i}
          className="font-extrabold text-base mt-3 mb-1 text-slate-900 dark:text-white"
        >
          {line.slice(3)}
        </h2>
      );
    }

    if (line.startsWith('> ')) {
      return (
        <blockquote
          key={i}
          className="border-l-2 border-indigo-400 pl-3 text-xs text-slate-500 dark:text-slate-400 my-2 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-r-xl py-2"
        >
          {line.slice(2)}
        </blockquote>
      );
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li
          key={i}
          className="ml-5 list-disc text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {parseBold(line.slice(2))}
        </li>
      );
    }

    if (line.match(/^\d+\. /)) {
      return (
        <li
          key={i}
          className="ml-5 list-decimal text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {parseBold(line.replace(/^\d+\. /, ''))}
        </li>
      );
    }

    if (line.startsWith('```')) return null;

    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    return (
      <p
        key={i}
        className="text-sm leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {parseBold(line)}
      </p>
    );
  });
}

function Message({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[86%] px-4 py-3 rounded-3xl text-sm shadow-sm ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-lg'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-lg'
        }`}
      >
        {isUser ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : (
          <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
        )}

        {msg.buttons && (
          <div className="flex flex-wrap gap-2 mt-4">
            {msg.buttons.map((b, i) => (
              <button
                key={i}
                onClick={b.onClick}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <div
          className={`text-[11px] mt-2 font-medium ${
            isUser ? 'text-indigo-100/80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
}

export default function InternOpsAssistant() {
  const [tab, setTab] = useState('chat');
  const [role, setRole] = useState('Admin');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [history, setHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const addBotMessage = (content, buttons = null) => {
    const msg = { role: 'bot', content, time: now(), buttons };
    setMessages((prev) => [...prev, msg]);
    setHistory((prev) => [
      ...prev,
      { role: 'assistant', content, time: now() },
    ]);
  };

  useEffect(() => {
    const welcome = {
      role: 'bot',
      content: `Hi! I'm the **UptoSkills InternOps Assistant** 👋\n\nSelect your **role** in the top-right to get role-specific answers. I can help with:\n\n- 🏢 About UptoSkills platform\n- ⭐ Ratings — submit, view history, permissions\n- 📋 Social tasks — create, upload proof, verify\n- 📅 Attendance, meetings, sessions, reports`,
      time: now(),
      buttons: CONTEXT_BUTTONS.map((b) => ({
        label: b.label,
        onClick: () => handleSend(b.prompt),
      })),
    };

    setMessages([welcome]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const msg = text || input.trim();

    if (!msg) return;

    setInput('');

    const userMsg = { role: 'user', content: msg, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setHistory((prev) => [...prev, { role: 'user', content: msg }]);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    const kbAnswer = getKBResponse(msg);

    if (kbAnswer) {
      setIsTyping(false);
      addBotMessage(kbAnswer);
      return;
    }

    // Role permissions query
    if (
      msg.toLowerCase().includes('what can i do') ||
      msg.toLowerCase().includes('my permissions') ||
      msg.toLowerCase().includes('my role')
    ) {
      const perms = ROLE_PERMISSIONS[role];
      const answer = `**Your role: ${role}**\n\n**✅ You can:**\n${perms.canDo
        .map((x) => `- ${x}`)
        .join('\n')}\n\n**❌ You cannot:**\n${perms.cannotDo
        .map((x) => `- ${x}`)
        .join('\n')}`;

      setIsTyping(false);
      addBotMessage(answer);
      return;
    }

    // Fallback to backend AI provider service
    try {
      const systemPrompt = `You are the InternOps Assistant, an expert on the InternOps Enterprise Workforce Management Platform. The user's current role is: ${role}.

InternOps has a 5-tier hierarchy: Admin > Senior TL > TL > Captain > Intern.
Key modules: Attendance, Ratings (immutable), Social Tasks + Proof Submissions (auto-delete after 24h verification), Meetings, Notifications, Reports/Analytics, Session Management, Audit Logs.
Tech stack: Node.js/Fastify backend, React/Vite frontend, PostgreSQL (raw SQL, no ORM), JWT auth, Argon2 password hashing, Redis optional.

Give concise, role-aware answers. Use markdown formatting with bullet points. Keep answers under 150 words unless the topic requires more detail.`;

      const response = await api.post('/ai/chat', {
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...history.slice(-6).map((h) => ({
            role: h.role === 'bot' ? 'assistant' : h.role,
            content: h.content,
          })),
          {
            role: 'user',
            content: msg,
          },
        ],
      });

      const answer =
        response.data?.content ||
        "Sorry, I couldn't process that. Please try rephrasing.";

      setIsTyping(false);
      addBotMessage(answer);
    } catch {
      setIsTyping(false);
      addBotMessage(
        '⚠️ Could not reach the AI service. Please check your connection and try again.'
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setHistory([]);

    setTimeout(() => {
      const welcome = {
        role: 'bot',
        content: `Hi! I'm the InternOps Assistant.\n\nSelect your **role** in the top-right to get role-specific answers. I can help with:\n\n- Ratings — submit, view history, permissions\n- Social tasks — create, upload proof, verify\n- Attendance, meetings, sessions, reports`,
        time: now(),
        buttons: CONTEXT_BUTTONS.map((b) => ({
          label: b.label,
          onClick: () => handleSend(b.prompt),
        })),
      };

      setMessages([welcome]);
    }, 100);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[680px] rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-none">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white px-5 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-sm font-extrabold shadow-sm">
            IO
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="font-extrabold text-base">
                InternOps Assistant
              </span>
            </div>

            <div className="text-xs text-indigo-100">
              Ratings · Social Tasks · Platform Help
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CustomSelect
            value={role}
            onChange={setRole}
            options={ROLE_OPTIONS}
            placeholder="Select role"
            className="w-40"
          />

          <button
            onClick={clearChat}
            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white text-sm transition-colors"
            title="Clear chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        {['chat', 'faq', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-extrabold capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'faq' ? 'Quick FAQ' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-5 bg-slate-50 dark:bg-slate-950">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}

            {isTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-3xl rounded-bl-lg shadow-sm flex gap-1 items-center">
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick action chips */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_ACTIONS.map((a, i) => (
              <button
                key={i}
                onClick={() => handleSend(a.prompt)}
                className="whitespace-nowrap px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors flex-shrink-0 text-slate-700 dark:text-slate-200"
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about ratings, tasks, attendance..."
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 font-extrabold"
            >
              ➤
            </button>
          </div>
        </>
      )}

      {/* FAQ Tab */}
      {tab === 'faq' && (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-slate-50 dark:bg-slate-950">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-semibold">
            Tap a question to ask it in chat.
          </p>

          {QUICK_FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm transition-all"
              onClick={() => {
                setTab('chat');
                setTimeout(() => handleSend(faq.q), 100);
              }}
            >
              <p className="font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mb-1">
                {faq.q}
              </p>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {faq.a.replace(/\*\*/g, '')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto px-4 py-5 bg-slate-50 dark:bg-slate-950">
          {history.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 mt-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm font-bold">No conversation history yet.</p>
              <p className="text-xs mt-1">
                Start chatting to see messages here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  className={`flex ${
                    h.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs border ${
                      h.role === 'user'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border-indigo-100 dark:border-indigo-900/60'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="font-extrabold">
                      {h.role === 'user' ? 'You' : 'Assistant'}:{' '}
                    </span>
                    {h.content.slice(0, 120)}
                    {h.content.length > 120 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
