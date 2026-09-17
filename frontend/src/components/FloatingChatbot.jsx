import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, X, Sparkles, ChevronDown, RotateCcw } from 'lucide-react';
import api, { getAiChatErrorMessage } from '../lib/axios';
import useAuthStore from '../store/auth';

// ── Local knowledge base for instant offline answers ─────────────────────────
const KB = {
  uptoskills: `**About UptoSkills 🚀**

UptoSkills is India's AI-powered ecosystem connecting **Candidates, Colleges & Corporates**.

Features: 🎮 Gamified learning · 🧠 Smart assessments · 🏆 Hackathons · 💼 Jobs & internships · 🤖 AI Practice Hub · 🏅 Aura Rewards · 📜 Certificates · 🔁 Refer & Earn`,

  attendance: `**Marking Attendance 📅**

1. Go to **Attendance** in the sidebar
2. Choose **Single** (one person) or **Bulk** (multiple people)
3. Select member, date, and status: Present / Absent / Late / Half Day
4. Add optional remarks → **Submit**

> Attendance is visible based on your role and hierarchy.`,

  rating: `**Submitting a Rating ⭐**

1. Go to **Ratings** in the sidebar
2. Select a team member *directly below* you
3. Enter score and remarks → **Submit**

> ⚠️ Ratings are **permanent** — they cannot be edited or deleted.`,

  task: `**Social Tasks 📋**

**Create a task** (Admin / Senior TL / TL):
1. Go to **Tasks** → **Create Task**
2. Fill in title, platform, link, deadline → Submit

**Upload proof** (Intern):
1. Open your assigned task → **Upload Proof**
2. Select screenshot → Submit for verification`,

  proof: `**Uploading Proof 📤**

1. Go to **Tasks** in the sidebar
2. Open your assigned task
3. Click **Upload Proof**
4. Select screenshot/image → **Submit**

Your proof will be reviewed by your manager.`,

  verify: `**Verifying Proof ✅**

1. Go to **Tasks** → open pending submissions
2. Review the uploaded proof image
3. Click **Approve** or **Reject**

> Captains, TLs, Senior TLs, and Admins can verify proofs.`,

  meetings: `**Meetings 🎥**

1. Go to **Meetings** in the sidebar
2. Schedule with title, date, time, and attendees
3. Submit the meeting

Only relevant users see the meeting details.`,

  sessions: `**Session Management 🔒**

Go to **Sessions** in the sidebar to:
- View all active login devices
- **Revoke** a specific session
- **Revoke all** sessions to fully secure your account`,

  reports: `**Reports & Analytics 📊**

Go to **Reports** in the sidebar *(Admin & Senior TL only)*:
- Attendance summary · Ratings summary · Task completion
- Department trends · CSV exports

**Analytics** (requires ADVANCED_ANALYTICS feature flag) shows graphical trends.`,

  hierarchy: `**Platform Hierarchy 🏢**

\`\`\`
Admin → Senior TL → TL → Captain → Intern
\`\`\`

Each user can only see data within their branch. You can only rate users **directly below** you.`,

  notifications: `**Notifications 🔔**

Go to **Notifications** in the sidebar to see:
- Attendance marks
- Rating submissions
- Proof verification updates
- System announcements`,

  profile: `**Profile 👤**

Go to **Profile** in the sidebar to:
- Update your name and avatar
- Change your password
- View your account details`,

  certificates: `**Certificates 🏆** *(Admin only)*

- **Quick Generate**: Single certificate instantly
- **Bulk Generate**: Multiple certificates at once
- **AI Certificates**: AI-powered content with tone & language options
- **Templates & Canva**: Canva-integrated design templates`,

  audit: `**Audit Logs 📜** *(Admin only)*

Go to **Audit** in the admin section to track:
- User creation & role changes
- Attendance marks
- Session revocations
- Proof verifications`,
};

function getKBResponse(text) {
  const t = text.toLowerCase();
  if (
    t.includes('uptoskills') ||
    t.includes('about') ||
    t.includes('platform') ||
    t.includes('what is')
  )
    return KB.uptoskills;
  if (t.includes('attendance') || t.includes('mark')) return KB.attendance;
  if (t.includes('rating') || t.includes('rate')) return KB.rating;
  if (t.includes('create task') || t.includes('social task')) return KB.task;
  if (t.includes('upload proof') || t.includes('proof sub')) return KB.proof;
  if (t.includes('verify') || t.includes('verification')) return KB.verify;
  if (t.includes('meeting')) return KB.meetings;
  if (t.includes('session')) return KB.sessions;
  if (t.includes('report') || t.includes('analytic')) return KB.reports;
  if (t.includes('hierarchy') || t.includes('role') || t.includes('permission'))
    return KB.hierarchy;
  if (t.includes('notification')) return KB.notifications;
  if (t.includes('profile') || t.includes('password')) return KB.profile;
  if (t.includes('certificate')) return KB.certificates;
  if (t.includes('audit') || t.includes('log')) return KB.audit;
  return null;
}

// ── Quick action chips ────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { label: '📅 Attendance', prompt: 'How do I mark attendance?' },
  { label: '⭐ Submit rating', prompt: 'How do I submit a rating?' },
  { label: '📋 Create task', prompt: 'How do I create a social task?' },
  { label: '📤 Upload proof', prompt: 'How do I upload proof for a task?' },
  { label: '🔒 Sessions', prompt: 'How do I revoke a session?' },
  { label: '🚀 About UptoSkills', prompt: 'What is UptoSkills?' },
];

// ── Markdown-to-JSX renderer (simple) ────────────────────────────────────────
function renderText(text) {
  const lines = text.split('\n');

  // Group consecutive list items into ul/ol wrappers
  const groups = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = [];
      while (
        i < lines.length &&
        (lines[i].startsWith('- ') || lines[i].startsWith('* '))
      ) {
        items.push(lines[i].slice(2));
        i++;
      }
      groups.push({ type: 'ul', items });
    } else if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      groups.push({ type: 'ol', items });
    } else {
      groups.push({ type: 'line', content: line });
      i++;
    }
  }

  return groups.map((group, gi) => {
    if (group.type === 'ul') {
      return (
        <ul key={gi} className="ml-4 list-disc space-y-0.5 my-1">
          {group.items.map((item, j) => (
            <li
              key={j}
              className="text-xs leading-relaxed text-slate-700 dark:text-slate-300"
            >
              {boldify(item)}
            </li>
          ))}
        </ul>
      );
    }
    if (group.type === 'ol') {
      return (
        <ol key={gi} className="ml-4 list-decimal space-y-0.5 my-1">
          {group.items.map((item, j) => (
            <li
              key={j}
              className="text-xs leading-relaxed text-slate-700 dark:text-slate-300"
            >
              {boldify(item)}
            </li>
          ))}
        </ol>
      );
    }
    const line = group.content;
    if (line.startsWith('> ')) {
      return (
        <blockquote
          key={gi}
          className="border-l-2 border-indigo-400 pl-3 text-xs text-slate-500 dark:text-slate-400 my-1.5 italic"
        >
          {boldify(line.slice(2))}
        </blockquote>
      );
    }
    if (line.startsWith('```') || line.trim() === '')
      return <div key={gi} className="h-1" />;
    return (
      <p
        key={gi}
        className="text-xs leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {boldify(line)}
      </p>
    );
  });
}

function boldify(text) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-slate-900 dark:text-white">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs shadow-sm ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-sm'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : (
          <div className="space-y-0.5">{renderText(msg.content)}</div>
        )}
        {msg.buttons && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.buttons.map((button, index) => (
              <button
                key={index}
                onClick={button.onClick}
                className="px-2.5 py-1 text-[11px] font-bold border border-slate-200 dark:border-slate-700 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
        <p
          className={`text-[10px] mt-1 ${isUser ? 'text-indigo-100/70' : 'text-slate-400 dark:text-slate-500'}`}
        >
          {msg.time}
        </p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start mb-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mr-2 shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
        <span
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]); // for AI context window
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('floating-chatbot-position')) || null
      );
    } catch {
      return null;
    }
  });
  const messagesEndRef = useRef(null);
  const dragRef = useRef(null);
  const inputRef = useRef(null);

  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'INTERN';

  const isAllowed = ['ADMIN', 'SENIOR_TL', 'TL'].includes(role);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const addBot = useCallback(
    (content, buttons = null) => {
      const msg = { role: 'bot', content, time: now(), buttons };
      setMessages((prev) => [...prev, msg]);
      setHistory((prev) => [...prev, { role: 'assistant', content }]);
      if (!open) setUnread((n) => n + 1);
    },
    [open]
  );

  // Welcome message on mount
  useEffect(() => {
    const welcome = `Hi! 👋 I'm the **InternOps Assistant**.

I can help you with anything in the platform — attendance, ratings, tasks, meetings, sessions, reports, and more.

What do you need help with?`;
    setMessages([{ role: 'bot', content: welcome, time: now() }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === 'function'
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = useCallback(
    async (text) => {
      const msg = text || input.trim();
      if (!msg || isTyping) return;

      setInput('');

      const userMsg = { role: 'user', content: msg, time: now() };
      setMessages((prev) => [...prev, userMsg]);
      setHistory((prev) => [...prev, { role: 'user', content: msg }]);
      setIsTyping(true);

      // Small human-feel delay
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 250));

      // 1️⃣ Try local KB first (instant, no API call needed)
      const kbAnswer = getKBResponse(msg);
      if (kbAnswer) {
        setIsTyping(false);
        addBot(kbAnswer);
        return;
      }

      // 2️⃣ Fall back to AI service via backend
      try {
        const roleLabel = role.replace(/_/g, ' ');
        const res = await api.post(
          '/ai/chat',
          {
            messages: [
              {
                role: 'system',
                content: `You are the InternOps AI Assistant. The current user's role is: ${roleLabel}. Give concise, role-aware answers about InternOps platform features, permissions, and how-to guidance.`,
              },
              // last 6 messages for context
              ...history.slice(-6).map((h) => ({
                role: h.role === 'bot' ? 'assistant' : h.role,
                content: h.content,
              })),
              { role: 'user', content: msg },
            ],
          },
          // The failure is already surfaced as an in-chat message below, so
          // suppress the global error toast to avoid showing the user two
          // separate error messages for the same failed request (#1795).
          { _suppressGlobalError: true }
        );

        const answer =
          res.data?.content ||
          "Sorry, I couldn't process that. Please try rephrasing.";
        setIsTyping(false);
        addBot(answer);
      } catch (err) {
        setIsTyping(false);
        const { message, retryable } = getAiChatErrorMessage(err);
        addBot(
          `⚠️ ${message}`,
          retryable
            ? [{ label: 'Retry', onClick: () => handleSend(msg) }]
            : null
        );
      }
    },
    [input, isTyping, history, role, addBot]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setHistory([]);
    setMessages([
      {
        role: 'bot',
        content: `Chat cleared! 👋 Ask me anything about the InternOps platform.`,
        time: now(),
      },
    ]);
  };

  const clampPosition = useCallback((x, y) => {
    const margin = 12;
    const size = 56;
    return {
      x: Math.min(Math.max(margin, x), window.innerWidth - size - margin),
      y: Math.min(Math.max(margin, y), window.innerHeight - size - margin),
    };
  }, []);
  const handleTriggerPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };
  const handleTriggerPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5
    )
      drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    setTriggerPosition(
      clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY)
    );
  };
  const handleTriggerPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) {
      setOpen((value) => !value);
      return;
    }
    const position = clampPosition(
      event.clientX - drag.offsetX,
      event.clientY - drag.offsetY
    );
    setTriggerPosition(position);
    localStorage.setItem('floating-chatbot-position', JSON.stringify(position));
  };
  useEffect(() => {
    if (!triggerPosition) return undefined;
    const keepInBounds = () =>
      setTriggerPosition((value) =>
        value ? clampPosition(value.x, value.y) : value
      );
    window.addEventListener('resize', keepInBounds);
    return () => window.removeEventListener('resize', keepInBounds);
  }, [clampPosition, triggerPosition]);
  const panelStyle = (() => {
    if (!triggerPosition) return undefined;
    const panelWidth = Math.min(360, window.innerWidth - 24);
    const panelHeight = Math.min(520, window.innerHeight - 24);
    const gap = 12;
    const margin = 12;
    const triggerSize = 56;
    const spaceRight = window.innerWidth - (triggerPosition.x + triggerSize);
    const left =
      spaceRight >= panelWidth + gap
        ? triggerPosition.x + triggerSize + gap
        : Math.max(margin, triggerPosition.x - panelWidth - gap);
    const top =
      triggerPosition.y >= panelHeight + gap
        ? triggerPosition.y - panelHeight - gap
        : Math.min(
            triggerPosition.y + triggerSize + gap,
            window.innerHeight - panelHeight - margin
          );
    return { left, top, width: panelWidth, height: panelHeight };
  })();
  if (!isAllowed) return null;
  return (
    <>
      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      <div
        className={`fixed z-50 max-w-[calc(100vw-1.5rem)] transition-all duration-300 ease-in-out ${
          triggerPosition
            ? 'origin-center'
            : 'bottom-24 right-5 w-[360px] origin-bottom-right'
        } ${
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0'
        }`}
        style={panelStyle}
        aria-hidden={!open}
      >
        <div
          className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-950"
          style={triggerPosition ? undefined : { height: '520px' }}
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_40%)]" />
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    <p className="text-sm font-extrabold leading-none">
                      InternOps Assistant
                    </p>
                  </div>
                  <p className="text-[11px] text-indigo-100 mt-0.5">
                    Powered by AI · Always available
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  title="Clear chat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  title="Minimize"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50 dark:bg-slate-950 space-y-0.5 min-h-0">
            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} />
            ))}
            {isTyping && <TypingDots />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick chips */}
          <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleSend(chip.prompt)}
                disabled={isTyping}
                className="whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:opacity-40 shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 flex gap-2 items-end bg-white dark:bg-slate-900 shrink-0">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about InternOps…"
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 hover:shadow-lg hover:shadow-indigo-600/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Floating trigger button ───────────────────────────────────────── */}
      <button
        id="floating-chatbot-trigger"
        onPointerDown={handleTriggerPointerDown}
        onPointerMove={handleTriggerPointerMove}
        onPointerUp={handleTriggerPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        style={
          triggerPosition
            ? {
                left: triggerPosition.x,
                top: triggerPosition.y,
                touchAction: 'none',
              }
            : { touchAction: 'none' }
        }
        className={`fixed z-50 w-14 h-14 rounded-full shadow-2xl shadow-indigo-600/40 flex items-center justify-center transition-colors duration-300 hover:scale-105 active:scale-95 ${triggerPosition ? '' : 'bottom-5 right-5'} ${
          open
            ? 'bg-gradient-to-br from-slate-700 to-slate-900 rotate-0'
            : 'bg-gradient-to-br from-indigo-600 to-violet-600'
        }`}
        aria-label={open ? 'Close assistant' : 'Open InternOps Assistant'}
        title={open ? 'Close assistant' : 'Ask InternOps Assistant'}
      >
        {/* Pulse ring — only when closed */}
        {!open && (
          <span className="absolute w-full h-full rounded-full bg-indigo-500/40 animate-ping" />
        )}
        <span className="relative">
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Bot className="w-6 h-6 text-white" />
          )}
        </span>
        {/* Unread badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
