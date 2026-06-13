import { useState, useRef, useEffect } from 'react';

const ROLES = ['Admin', 'Senior TL', 'TL', 'Captain', 'Intern'];

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
  { label: 'Submit rating', prompt: 'How do I submit a rating?' },
  { label: 'Create task', prompt: 'How do I create a social task?' },
  { label: 'Upload proof', prompt: 'How do I upload proof for a task?' },
  { label: 'Verify task', prompt: 'How do I verify a proof submission?' },
  { label: 'Attendance', prompt: 'How do I mark attendance?' },
];

const CONTEXT_BUTTONS = [
  { label: 'Submit a rating', prompt: 'How do I submit a rating?' },
  { label: 'Create a social task', prompt: 'How do I create a social task?' },
  { label: 'Mark attendance', prompt: 'How do I mark attendance?' },
  { label: 'View reports', prompt: 'How do I view reports and analytics?' },
];

const KB = {
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
  if (t.includes('rating') || t.includes('rate')) return KB.rating;
  if (t.includes('social task') || t.includes('create task')) return KB.task;
  if (t.includes('upload proof') || t.includes('proof')) return KB.proof;
  if (t.includes('verify') || t.includes('verification')) return KB.verify;
  if (t.includes('attendance') || t.includes('mark')) return KB.attendance;
  if (t.includes('report') || t.includes('analytics')) return KB.reports;
  if (t.includes('session')) return KB.sessions;
  if (t.includes('meeting')) return KB.meetings;
  if (t.includes('hierarchy') || t.includes('role') || t.includes('permission'))
    return KB.hierarchy;
  if (t.includes('audit') || t.includes('log')) return KB.audit;
  return null;
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('### '))
      return (
        <h3 key={i} className="font-bold text-sm mt-2 mb-1">
          {line.slice(4)}
        </h3>
      );
    if (line.startsWith('## '))
      return (
        <h2 key={i} className="font-bold text-base mt-2 mb-1">
          {line.slice(3)}
        </h2>
      );
    if (line.startsWith('> '))
      return (
        <blockquote
          key={i}
          className="border-l-2 border-indigo-400 pl-2 text-xs text-gray-500 my-1"
        >
          {line.slice(2)}
        </blockquote>
      );
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="ml-4 list-disc text-sm">
          {parseBold(line.slice(2))}
        </li>
      );
    }
    if (line.match(/^\d+\. /)) {
      return (
        <li key={i} className="ml-4 list-decimal text-sm">
          {parseBold(line.replace(/^\d+\. /, ''))}
        </li>
      );
    }
    if (line.startsWith('```')) return null;
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-sm leading-relaxed">
        {parseBold(line)}
      </p>
    );
  });
}

function parseBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
        )}
        {msg.buttons && (
          <div className="flex flex-wrap gap-2 mt-3">
            {msg.buttons.map((b, i) => (
              <button
                key={i}
                onClick={b.onClick}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-full hover:bg-indigo-50 hover:border-indigo-400 transition-colors bg-gray-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        <div
          className={`text-xs mt-1 ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}
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
      content: `Hi! I'm the InternOps Assistant.\n\nSelect your **role** in the top-right to get role-specific answers. I can help with:\n\n- Ratings — submit, view history, permissions\n- Social tasks — create, upload proof, verify\n- Attendance, meetings, sessions, reports`,
      time: now(),
      buttons: CONTEXT_BUTTONS.map((b) => ({
        label: b.label,
        onClick: () => handleSend(b.prompt),
      })),
    };
    setMessages([welcome]);
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
      const answer = `**Your role: ${role}**\n\n**✅ You can:**\n${perms.canDo.map((x) => `- ${x}`).join('\n')}\n\n**❌ You cannot:**\n${perms.cannotDo.map((x) => `- ${x}`).join('\n')}`;
      setIsTyping(false);
      addBotMessage(answer);
      return;
    }

    // Fallback to Claude API
    try {
      const systemPrompt = `You are the InternOps Assistant, an expert on the InternOps Enterprise Workforce Management Platform. The user's current role is: ${role}.

InternOps has a 5-tier hierarchy: Admin > Senior TL > TL > Captain > Intern.
Key modules: Attendance, Ratings (immutable), Social Tasks + Proof Submissions (auto-delete after 24h verification), Meetings, Notifications, Reports/Analytics, Session Management, Audit Logs.
Tech stack: Node.js/Fastify backend, React/Vite frontend, PostgreSQL (raw SQL, no ORM), JWT auth, Argon2 password hashing, Redis optional.

Give concise, role-aware answers. Use markdown formatting with bullet points. Keep answers under 150 words unless the topic requires more detail.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...history.slice(-6).map((h) => ({
              role: h.role === 'bot' ? 'assistant' : h.role,
              content: h.content,
            })),
            { role: 'user', content: msg },
          ],
        }),
      });

      const data = await response.json();
      const answer =
        data.content?.[0]?.text ||
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
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-lg font-bold">
            IO
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-semibold text-base">
                InternOps Assistant
              </span>
            </div>
            <div className="text-xs text-indigo-200">
              Ratings · Social Tasks · Platform Help
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-indigo-600 border border-indigo-400 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={clearChat}
            className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white text-sm transition-colors"
            title="Clear chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-50 border-b border-gray-200">
        {['chat', 'faq', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'faq' ? 'Quick FAQ' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1 items-center">
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
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_ACTIONS.map((a, i) => (
              <button
                key={i}
                onClick={() => handleSend(a.prompt)}
                className="whitespace-nowrap px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-full hover:bg-indigo-50 hover:border-indigo-400 transition-colors flex-shrink-0"
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about ratings, tasks, attendance..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-gray-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
            >
              ➤
            </button>
          </div>
        </>
      )}

      {/* FAQ Tab */}
      {tab === 'faq' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            Tap a question to ask it in chat.
          </p>
          {QUICK_FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all"
              onClick={() => {
                setTab('chat');
                setTimeout(() => handleSend(faq.q), 100);
              }}
            >
              <p className="font-medium text-sm text-indigo-700 mb-1">
                {faq.q}
              </p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {faq.a.replace(/\*\*/g, '')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 mt-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm">No conversation history yet.</p>
              <p className="text-xs mt-1">
                Start chatting to see messages here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                      h.role === 'user'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="font-semibold">
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
