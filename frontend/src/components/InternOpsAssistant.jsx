import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  MessageCircle,
  HelpCircle,
  History,
  ShieldCheck,
  Send,
  X,
  CheckCircle2,
  Ban,
  Zap,
} from 'lucide-react';
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
      'Mark attendance',
      'Submit & view ratings',
      'Create social tasks',
      'Verify proofs',
      'View reports & analytics',
      'Manage sessions',
      'Audit logs',
      'Manage users',
    ],
    cannotDo: ['Nothing — full access to all resources'],
  },
  'Senior TL': {
    canDo: [
      'Manage TLs, Captains, Interns',
      'Create social tasks',
      'Verify proofs',
      'View department reports',
      'Mark attendance',
      'Submit ratings',
    ],
    cannotDo: ['Access unrelated departments', 'View audit logs'],
  },
  TL: {
    canDo: [
      'Manage Captains and Interns',
      'Submit ratings to Captains',
      'Mark attendance',
      'Verify proofs',
      'Schedule meetings',
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
    a: "UptoSkills is India's AI-powered platform connecting Candidates, Colleges & Corporates with learning, assessments, hackathons, jobs, internships, AI Practice Hub, and rewards.",
  },
  {
    q: 'How does the rating system work?',
    a: 'Ratings are permanent and immutable. You can rate only users directly below you in the hierarchy.',
  },
  {
    q: 'How does attendance marking work?',
    a: 'Attendance supports single and bulk marking with remarks. Records are tracked and visible based on hierarchy permissions.',
  },
  {
    q: 'How do proof submissions work?',
    a: 'Interns upload proof images for tasks. Captains, TLs, Senior TLs, or Admins can verify proof submissions.',
  },
  {
    q: 'How does the hierarchy work?',
    a: 'Hierarchy follows Admin → Senior TL → TL → Captain → Intern. Access is limited to users within your branch.',
  },
  {
    q: 'What is session management?',
    a: 'Sessions allow users to view active devices and revoke access from specific devices or all devices.',
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
  uptoskills: `**About UptoSkills 🚀**

**"Let's Make Freshers Employable!"**

UptoSkills is an AI-powered ecosystem connecting **Candidates, Colleges & Corporates**.

It helps with:

- 🎮 Gamified learning
- 🧠 Smart assessments
- 🏆 Hackathons and competitions
- 💼 Job and internship matching
- 🤖 AI Practice Hub
- 🏅 Aura Rewards
- 📜 Certificates
- 🔁 Refer & Earn

UptoSkills helps freshers become industry-ready and helps organizations find skilled talent.`,

  platform: `**UptoSkills Platform Features**

The platform includes:

- 🏆 Competitions
- 💼 Jobs
- 🎓 Internships
- 🤖 AI Practice Hub
- 🏅 Leagues
- 📅 Events
- ⭐ Aura Rewards
- 📜 Certificates
- 🔁 Refer & Earn

It is designed to support students, colleges, and companies in one place.`,

  rating: `**Submitting a Rating**

1. Go to **Ratings**.
2. Select a team member.
3. Enter score and remarks.
4. Submit the rating.

Ratings are permanent and cannot be edited later.

> You can only rate users directly below you in the hierarchy.`,

  task: `**Creating a Social Task**

1. Go to **Tasks**.
2. Click **Create Task**.
3. Add title, description, platform, link, and deadline.
4. Submit the task.

Interns can then upload proof for assigned tasks.`,

  proof: `**Uploading Proof**

1. Open your assigned task.
2. Click **Upload Proof**.
3. Select screenshot or image.
4. Submit for verification.

The proof will be reviewed by the appropriate manager.`,

  verify: `**Verifying Proof**

1. Open pending proof submissions.
2. Review uploaded proof.
3. Approve or reject the submission.
4. The intern receives status update after verification.`,

  attendance: `**Marking Attendance**

1. Go to **Attendance**.
2. Choose single or bulk attendance.
3. Select member, date, and status.
4. Submit attendance.

Attendance can be marked based on your hierarchy permissions.`,

  reports: `**Reports and Analytics**

Reports include:

- Attendance summary
- Ratings summary
- Task completion
- Department attendance
- Attendance trends
- CSV exports

Admin and Senior TL roles have broader reporting access.`,

  sessions: `**Session Management**

You can:

- View active sessions
- Revoke one session
- Revoke all sessions
- Secure your account from unknown devices`,

  meetings: `**Scheduling Meetings**

1. Go to **Meetings**.
2. Schedule a meeting with date and time.
3. Add attendees.
4. Submit the meeting.

Only relevant users can view meeting details.`,

  hierarchy: `**Hierarchy Model**

The hierarchy is:

\`\`\`
Admin
  └── Senior TL
        └── TL
              └── Captain
                    └── Intern
\`\`\`

Each user only accesses data allowed by their role and reporting branch.`,

  audit: `**Audit Logs**

Audit logs track sensitive actions such as:

- User creation
- Attendance marking
- Role updates
- Session actions
- Proof verification

Audit logs help maintain accountability.`,
};

function getKBResponse(text) {
  const t = text.toLowerCase();

  if (
    t.includes('uptoskills') ||
    t.includes('upskill') ||
    t.includes('about this platform') ||
    t.includes('about the platform') ||
    t.includes('what is this') ||
    t.includes('company info') ||
    t.includes('about us')
  ) {
    return KB.uptoskills;
  }

  if (
    t.includes('dashboard') ||
    t.includes('aura') ||
    t.includes('leagues') ||
    t.includes('hackathon') ||
    t.includes('competition') ||
    t.includes('platform feature')
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

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong
        key={index}
        className="font-extrabold text-slate-950 dark:text-white"
      >
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function renderMarkdown(text) {
  const lines = text.split('\n');

  return lines.map((line, index) => {
    if (line.startsWith('> ')) {
      return (
        <blockquote
          key={index}
          className="border-l-2 border-indigo-400 pl-3 text-xs text-slate-500 dark:text-slate-400 my-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-r-2xl py-2"
        >
          {parseBold(line.slice(2))}
        </blockquote>
      );
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li
          key={index}
          className="ml-5 list-disc text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {parseBold(line.slice(2))}
        </li>
      );
    }

    if (line.match(/^\d+\. /)) {
      return (
        <li
          key={index}
          className="ml-5 list-decimal text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {parseBold(line.replace(/^\d+\. /, ''))}
        </li>
      );
    }

    if (line.startsWith('```')) return null;

    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }

    return (
      <p
        key={index}
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
        className={`max-w-[88%] lg:max-w-[76%] px-4 py-3 rounded-[1.5rem] text-sm shadow-sm ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-md shadow-indigo-950/20'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : (
          <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
        )}

        {msg.buttons && (
          <div className="flex flex-wrap gap-2 mt-4">
            {msg.buttons.map((button, index) => (
              <button
                key={index}
                onClick={button.onClick}
                className="px-3 py-1.5 text-xs font-extrabold border border-slate-200 dark:border-slate-700 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {button.label}
              </button>
            ))}
          </div>
        )}

        <div
          className={`text-[11px] mt-3 font-bold ${
            isUser ? 'text-indigo-100/80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start mb-4">
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
  );
}

function RoleInsightPanel({ role }) {
  const perms = ROLE_PERMISSIONS[role];

  return (
    <div className="hidden xl:flex w-[330px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-extrabold">
                Active role
              </p>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {role}
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 mb-2">
                Can do
              </p>

              <div className="space-y-2">
                {perms.canDo.slice(0, 5).map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-300 mb-2">
                Restricted
              </p>

              <div className="space-y-2">
                {perms.cannotDo.slice(0, 3).map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-extrabold">
                Assistant modules
              </p>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                What I can explain
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              'Ratings hierarchy',
              'Attendance rules',
              'Proof verification',
              'Reports & analytics',
              'Sessions',
              'Audit logs',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
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

  const handleSend = useCallback(
    async (text) => {
      const msg = text || input.trim();

      if (!msg) return;

      setInput('');

      const userMsg = { role: 'user', content: msg, time: now() };
      setMessages((prev) => [...prev, userMsg]);
      setHistory((prev) => [...prev, { role: 'user', content: msg }]);
      setIsTyping(true);

      await new Promise((resolve) =>
        setTimeout(resolve, 450 + Math.random() * 300)
      );

      const kbAnswer = getKBResponse(msg);

      if (kbAnswer) {
        setIsTyping(false);
        addBotMessage(kbAnswer);
        return;
      }

      if (
        msg.toLowerCase().includes('what can i do') ||
        msg.toLowerCase().includes('my permissions') ||
        msg.toLowerCase().includes('my role')
      ) {
        const perms = ROLE_PERMISSIONS[role];
        const answer = `**Your role: ${role}**

**✅ You can:**
${perms.canDo.map((item) => `- ${item}`).join('\n')}

**❌ You cannot:**
${perms.cannotDo.map((item) => `- ${item}`).join('\n')}`;

        setIsTyping(false);
        addBotMessage(answer);
        return;
      }

      try {
        const systemPrompt = `You are the InternOps Assistant. The user's current role is: ${role}. Give concise, role-aware answers about InternOps modules, permissions, ratings, attendance, tasks, reports, sessions, meetings, and audit logs.`;

        const response = await api.post('/ai/chat', {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            ...history.slice(-6).map((item) => ({
              role: item.role === 'bot' ? 'assistant' : item.role,
              content: item.content,
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
    },
    [input, role, history]
  );

  useEffect(() => {
    const welcome = {
      role: 'bot',
      content: `Hi! I'm the **UptoSkills InternOps Assistant** 👋

I can help you understand platform workflows, role permissions, and daily operations.

- 🏢 About UptoSkills platform
- ⭐ Ratings — submit, view history, permissions
- 📋 Social tasks — create, upload proof, verify
- 📅 Attendance, meetings, sessions, reports`,
      time: now(),
      buttons: CONTEXT_BUTTONS.map((button) => ({
        label: button.label,
        onClick: () => handleSend(button.prompt),
      })),
    };

    setMessages([welcome]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setHistory([]);

    setTimeout(() => {
      const welcome = {
        role: 'bot',
        content: `Hi! I'm the **InternOps Assistant** 👋

Select your **role** in the top-right to get role-aware answers. I can help with ratings, social tasks, attendance, meetings, reports, sessions, and platform help.`,
        time: now(),
        buttons: CONTEXT_BUTTONS.map((button) => ({
          label: button.label,
          onClick: () => handleSend(button.prompt),
        })),
      };

      setMessages([welcome]);
    }, 100);
  };

  const tabs = [
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'faq', label: 'Quick FAQ', icon: HelpCircle },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="animate-fade-in-up h-[calc(100vh-6.5rem)] min-h-[680px] max-h-[calc(100vh-6.5rem)]">
      <div className="h-full rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-none flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_28%)]" />

          <div className="relative px-5 md:px-7 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-white/15 border border-white/20 flex items-center justify-center shadow-lg shadow-indigo-950/20">
                <Bot className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
                  <h2 className="text-xl md:text-2xl font-extrabold">
                    InternOps Assistant
                  </h2>
                </div>

                <p className="text-sm text-indigo-100 mt-1">
                  Role-aware help for ratings, tasks, attendance, reports, and
                  platform workflows.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-44">
                <CustomSelect
                  value={role}
                  onChange={setRole}
                  options={ROLE_OPTIONS}
                  placeholder="Select role"
                  className="w-full"
                />
              </div>

              <button
                onClick={clearChat}
                className="w-11 h-11 rounded-2xl bg-white/15 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
                title="Clear chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;

            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex items-center justify-center gap-2 py-3 text-sm font-extrabold transition-colors ${
                  active
                    ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/30 border-b-2 border-indigo-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Chat Tab */}
        {tab === 'chat' && (
          <div className="min-h-0 flex-1 flex overflow-hidden">
            <div className="min-w-0 flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6 py-5">
                <div className="max-w-5xl mx-auto">
                  {messages.map((msg, index) => (
                    <Message key={index} msg={msg} />
                  ))}

                  {isTyping && <TypingBubble />}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <div className="px-4 md:px-6 py-3 flex gap-2 overflow-x-auto">
                  {QUICK_ACTIONS.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(action.prompt)}
                      className="whitespace-nowrap px-3 py-1.5 text-xs font-extrabold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors flex-shrink-0 text-slate-700 dark:text-slate-200"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <div className="px-4 md:px-6 pb-4 flex gap-3 items-end">
                  <div className="relative flex-1">
                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />

                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about ratings, tasks, attendance..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-3xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                    />
                  </div>

                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-3xl hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center font-extrabold"
                    title="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <RoleInsightPanel role={role} />
          </div>
        )}

        {/* FAQ Tab */}
        {tab === 'faq' && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6 py-5 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-5xl mx-auto">
              <div className="mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Quick FAQ
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Tap a question to send it directly into chat.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {QUICK_FAQS.map((faq, index) => (
                  <button
                    key={index}
                    type="button"
                    className="text-left bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 hover:-translate-y-0.5 hover:shadow-md transition-all"
                    onClick={() => {
                      setTab('chat');
                      setTimeout(() => handleSend(faq.q), 100);
                    }}
                  >
                    <p className="font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                      {faq.q}
                    </p>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {faq.a.replace(/\*\*/g, '')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6 py-5 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-5xl mx-auto">
              <div className="mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Conversation History
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Recent prompts and assistant replies from this session.
                </p>
              </div>

              {history.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center mb-4">
                    <History className="w-7 h-7" />
                  </div>

                  <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                    No conversation history yet.
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Start chatting to see messages here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        item.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[82%] px-4 py-3 rounded-3xl text-xs border ${
                          item.role === 'user'
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border-indigo-100 dark:border-indigo-900/60'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="font-extrabold">
                          {item.role === 'user' ? 'You' : 'Assistant'}:{' '}
                        </span>
                        {item.content.slice(0, 180)}
                        {item.content.length > 180 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
