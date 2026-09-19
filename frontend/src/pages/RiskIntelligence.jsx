/**
 * RiskIntelligence.jsx
 *
 * AI-powered intern risk dashboard with:
 *   - Risk distribution overview
 *   - Sortable intern risk table with live badge indicators
 *   - Proactive alert management (acknowledge / resolve)
 *   - Individual intern risk drill-down with explainable factors
 *   - Historical risk trend sparkline
 *   - Confidence & data quality indicators
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronRight,
  ChevronDown,
  Users,
  Zap,
  BarChart3,
  Bell,
  BellOff,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RISK_LEVELS = {
  VERY_LOW: {
    label: 'Very Low',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    icon: ShieldCheck,
    badge: 'very-low',
  },
  LOW: {
    label: 'Low',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    icon: Activity,
    badge: 'low',
  },
  MODERATE: {
    label: 'Moderate',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    icon: AlertTriangle,
    badge: 'moderate',
  },
  HIGH: {
    label: 'High',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    icon: AlertOctagon,
    badge: 'high',
  },
  CRITICAL: {
    label: 'Critical',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.18)',
    icon: AlertOctagon,
    badge: 'critical',
  },
};

const SEVERITY_COLORS = {
  INFO: '#6b7280',
  LOW: '#3b82f6',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#7c3aed',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskBadge({ level, score }) {
  const config = RISK_LEVELS[level] || RISK_LEVELS.VERY_LOW;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: config.bg,
        color: config.color,
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.3px',
        border: `1px solid ${config.color}40`,
      }}
    >
      <config.icon size={11} />
      {config.label}
      {score !== undefined ? ` · ${Math.round(score)}` : ''}
    </span>
  );
}

function ScoreGauge({ score, size = 80 }) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const r = (size - 12) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color =
    pct >= 80
      ? '#7c3aed'
      : pct >= 60
        ? '#ef4444'
        : pct >= 40
          ? '#f59e0b'
          : pct >= 20
            ? '#3b82f6'
            : '#10b981';
  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontWeight: 800,
          fontSize: size < 70 ? '13px' : '15px',
          color,
        }}
      >
        {Math.round(pct)}
      </div>
    </div>
  );
}

function TrendIcon({ direction }) {
  if (direction === 'improving')
    return <TrendingDown size={14} color="#10b981" />;
  if (direction === 'worsening' || direction === 'rapidly_worsening')
    return <TrendingUp size={14} color="#ef4444" />;
  return <Minus size={14} color="#6b7280" />;
}

function AlertCard({ alert, onAcknowledge, onResolve, actionLoading }) {
  const color = SEVERITY_COLORS[alert.severity] || '#6b7280';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color,
                background: `${color}18`,
                padding: '2px 7px',
                borderRadius: '10px',
                border: `1px solid ${color}30`,
                letterSpacing: '0.5px',
              }}
            >
              {alert.severity}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              {alert.alert_type?.replace(/_/g, ' ')}
            </span>
            {alert.intern_name && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                }}
              >
                {alert.intern_name}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.88)',
              marginBottom: '4px',
            }}
          >
            {alert.title}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: '1.5',
            }}
          >
            {alert.description}
          </div>
          {alert.recommendation && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'rgba(99,179,237,0.9)',
                background: 'rgba(99,179,237,0.07)',
                padding: '6px 10px',
                borderRadius: '6px',
                borderLeft: '2px solid rgba(99,179,237,0.4)',
              }}
            >
              💡 {alert.recommendation}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          {alert.status === 'ACTIVE' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              disabled={actionLoading === alert.id}
              style={{
                background: 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Eye size={10} /> Ack
            </button>
          )}
          <button
            onClick={() => onResolve(alert.id)}
            disabled={actionLoading === alert.id}
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={10} /> Resolve
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.3)',
          display: 'flex',
          gap: '12px',
        }}
      >
        <span>
          <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
          {new Date(alert.last_triggered_at).toLocaleString()}
        </span>
        {alert.trigger_count > 1 && (
          <span>Triggered {alert.trigger_count}×</span>
        )}
      </div>
    </div>
  );
}

function FactorRow({ factor }) {
  const clr =
    factor.impact === 'HIGH'
      ? '#ef4444'
      : factor.impact === 'MEDIUM'
        ? '#f59e0b'
        : '#10b981';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.025)',
        borderRadius: '8px',
        marginBottom: '6px',
        border: `1px solid ${clr}15`,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: '2px',
          fontSize: '10px',
          fontWeight: 700,
          color: clr,
          background: `${clr}15`,
          padding: '2px 6px',
          borderRadius: '8px',
          border: `1px solid ${clr}25`,
        }}
      >
        {factor.impact}
      </span>
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '2px',
          }}
        >
          {factor.factor}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: '1.5',
          }}
        >
          {factor.description}
        </div>
      </div>
    </div>
  );
}

function DistributionBar({ distribution }) {
  if (!distribution) return null;
  const total = Number(distribution.total) || 1;
  const segments = [
    { key: 'very_low', label: 'Very Low', color: '#10b981' },
    { key: 'low', label: 'Low', color: '#3b82f6' },
    { key: 'moderate', label: 'Moderate', color: '#f59e0b' },
    { key: 'high', label: 'High', color: '#ef4444' },
    { key: 'critical', label: 'Critical', color: '#7c3aed' },
  ];
  return (
    <div>
      <div
        style={{
          display: 'flex',
          borderRadius: '8px',
          overflow: 'hidden',
          height: '12px',
          marginBottom: '8px',
        }}
      >
        {segments.map((s) => {
          const count = Number(distribution[s.key] || 0);
          const pct = (count / total) * 100;
          return pct > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct}%`, background: s.color }}
              title={`${s.label}: ${count}`}
            />
          ) : null;
        })}
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '2px',
                background: s.color,
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
              {s.label}:{' '}
              <b style={{ color: 'rgba(255,255,255,0.8)' }}>
                {distribution[s.key] || 0}
              </b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function RiskIntelligence() {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [selectedInternId, setSelectedInternId] = useState(null);
  const [internRisk, setInternRisk] = useState(null);
  const [internLoading, setInternLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | alerts | intern
  const [expandedIntern, setExpandedIntern] = useState(null);
  const [filterRisk, setFilterRisk] = useState('');
  const [error, setError] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterRisk ? `?riskLevel=${filterRisk}` : '';
      const res = await api.get(`/ai/performance/risk/dashboard${params}`);
      setDashboardData(res.data);
    } catch (err) {
      setError(
        'Could not load risk dashboard. Verify the backend migration has been applied.'
      );
    } finally {
      setLoading(false);
    }
  }, [filterRisk]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await api.get(
        '/ai/performance/alerts?status=ACTIVE&limit=100'
      );
      setAlerts(res.data.data || []);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchInternRisk = async (internId) => {
    setInternLoading(true);
    setInternRisk(null);
    try {
      const res = await api.get(`/ai/performance/${internId}/risk`);
      setInternRisk(res.data);
    } catch (err) {
      setInternRisk({
        error: err.response?.data?.error || 'Not yet computed.',
      });
    } finally {
      setInternLoading(false);
    }
  };

  const handleComputeRisk = async (internId) => {
    setComputing(true);
    try {
      const res = await api.post(`/ai/performance/${internId}/risk/compute`, {
        periodDays: 30,
      });
      setInternRisk(res.data);
      fetchDashboard();
    } catch (err) {
      console.error('Risk compute failed:', err);
    } finally {
      setComputing(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    setActionLoading(alertId);
    try {
      await api.patch(`/ai/performance/alerts/${alertId}/acknowledge`);
      fetchAlerts();
      fetchDashboard();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId) => {
    setActionLoading(alertId);
    try {
      await api.patch(`/ai/performance/alerts/${alertId}/resolve`);
      fetchAlerts();
      fetchDashboard();
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAlerts();
  }, [fetchDashboard, fetchAlerts]);

  useEffect(() => {
    if (selectedInternId) {
      setActiveTab('intern');
      fetchInternRisk(selectedInternId);
    }
  }, [selectedInternId]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const card = {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '20px',
  };

  const tab = (active) => ({
    padding: '8px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    background: active ? 'rgba(139,92,246,0.22)' : 'transparent',
    color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
    border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
    transition: 'all 0.2s',
  });

  const alertCount = dashboardData?.alert_summary?.active || 0;
  const criticalCount = dashboardData?.alert_summary?.critical_active || 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        color: '#f1f5f9',
        padding: '0',
        maxWidth: '1200px',
        margin: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.3px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Activity size={18} color="white" />
              </span>
              Risk Intelligence
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.45)',
                margin: '4px 0 0 46px',
              }}
            >
              AI-powered performance prediction · Proactive alerts ·
              Evidence-based insights
            </p>
          </div>
          <button
            onClick={() => {
              fetchDashboard();
              fetchAlerts();
            }}
            disabled={loading}
            style={{
              background: 'rgba(139,92,246,0.18)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {criticalCount > 0 && (
        <div
          style={{
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertOctagon size={16} color="#a78bfa" />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require
            immediate attention.
          </span>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              marginLeft: 'auto',
              background: 'rgba(124,58,237,0.3)',
              color: '#a78bfa',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View Alerts →
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#f87171',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button
          style={tab(activeTab === 'dashboard')}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart3 size={12} style={{ marginRight: 5, display: 'inline' }} />{' '}
          Dashboard
        </button>
        <button
          style={tab(activeTab === 'alerts')}
          onClick={() => setActiveTab('alerts')}
        >
          <Bell size={12} style={{ marginRight: 5, display: 'inline' }} />
          Alerts
          {alertCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {alertCount}
            </span>
          )}
        </button>
        {selectedInternId && (
          <button
            style={tab(activeTab === 'intern')}
            onClick={() => setActiveTab('intern')}
          >
            <Eye size={12} style={{ marginRight: 5, display: 'inline' }} />{' '}
            Intern Detail
          </button>
        )}
      </div>

      {/* ===================== DASHBOARD TAB ===================== */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Summary Cards */}
          {dashboardData && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {[
                {
                  label: 'Total Interns',
                  value: dashboardData.distribution?.total || 0,
                  color: '#a78bfa',
                  icon: Users,
                },
                {
                  label: 'Avg Risk Score',
                  value: dashboardData.distribution?.avg_risk_score ?? '—',
                  color: '#60a5fa',
                  suffix: '/100',
                  icon: BarChart3,
                },
                {
                  label: 'Active Alerts',
                  value: dashboardData.alert_summary?.active || 0,
                  color: '#f59e0b',
                  icon: Bell,
                },
                {
                  label: 'Critical',
                  value: Number(dashboardData.distribution?.critical) || 0,
                  color: '#7c3aed',
                  icon: AlertOctagon,
                },
                {
                  label: 'High Risk',
                  value: Number(dashboardData.distribution?.high) || 0,
                  color: '#ef4444',
                  icon: AlertTriangle,
                },
                {
                  label: 'No Prediction',
                  value: dashboardData.distribution?.no_prediction || 0,
                  color: '#6b7280',
                  icon: Clock,
                },
              ].map((item) => (
                <div key={item.label} style={{ ...card, textAlign: 'center' }}>
                  <item.icon
                    size={18}
                    color={item.color}
                    style={{ marginBottom: '6px' }}
                  />
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      color: item.color,
                    }}
                  >
                    {item.value}
                    {item.suffix || ''}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.45)',
                      marginTop: '2px',
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Risk Distribution Bar */}
          {dashboardData?.distribution && (
            <div style={{ ...card, marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  margin: '0 0 14px 0',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Risk Distribution
              </h3>
              <DistributionBar distribution={dashboardData.distribution} />
            </div>
          )}

          {/* Filters */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '14px',
              alignItems: 'center',
            }}
          >
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Risk Levels</option>
              {Object.entries(RISK_LEVELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              {dashboardData?.interns?.total || 0} interns shown
            </span>
          </div>

          {/* Intern Risk Table */}
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              Loading risk data…
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {[
                        'Intern',
                        'Risk Level',
                        'Risk Score',
                        'Perf Score',
                        'Trend',
                        'Alerts',
                        'Data',
                        'Computed',
                        'Actions',
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '12px 14px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '11px',
                            letterSpacing: '0.3px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData?.interns?.data || []).map((intern, idx) => (
                      <tr
                        key={intern.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background:
                            expandedIntern === intern.id
                              ? 'rgba(139,92,246,0.06)'
                              : idx % 2 === 0
                                ? 'transparent'
                                : 'rgba(255,255,255,0.01)',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            'rgba(255,255,255,0.04)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            expandedIntern === intern.id
                              ? 'rgba(139,92,246,0.06)'
                              : idx % 2 === 0
                                ? 'transparent'
                                : 'rgba(255,255,255,0.01)')
                        }
                      >
                        <td
                          style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'rgba(255,255,255,0.85)',
                            }}
                          >
                            {intern.full_name || intern.email}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'rgba(255,255,255,0.35)',
                            }}
                          >
                            {intern.department_name || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {intern.risk_level ? (
                            <RiskBadge level={intern.risk_level} />
                          ) : (
                            <span
                              style={{
                                color: 'rgba(255,255,255,0.2)',
                                fontSize: '12px',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {intern.risk_score != null ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <ScoreGauge score={intern.risk_score} size={44} />
                            </div>
                          ) : (
                            <span
                              style={{
                                color: 'rgba(255,255,255,0.2)',
                                fontSize: '12px',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            fontWeight: 600,
                            color:
                              intern.performance_score >= 75
                                ? '#10b981'
                                : intern.performance_score >= 50
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        >
                          {intern.performance_score != null
                            ? `${Math.round(intern.performance_score)}`
                            : '—'}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <TrendIcon direction={intern.trend_direction} />
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {intern.trend_change != null &&
                              Math.abs(intern.trend_change) > 0
                                ? `${intern.trend_change > 0 ? '+' : ''}${intern.trend_change}`
                                : '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {Number(intern.active_alert_count) > 0 ? (
                            <span
                              style={{
                                background: 'rgba(239,68,68,0.15)',
                                color: '#ef4444',
                                borderRadius: '10px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              {intern.active_alert_count} active
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.2)',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color:
                                intern.data_quality === 'HIGH'
                                  ? '#10b981'
                                  : intern.data_quality === 'GOOD'
                                    ? '#3b82f6'
                                    : intern.data_quality === 'MODERATE'
                                      ? '#f59e0b'
                                      : '#6b7280',
                            }}
                          >
                            {intern.data_quality || '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.35)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {intern.computed_at
                            ? new Date(intern.computed_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setSelectedInternId(intern.id)}
                              style={{
                                background: 'rgba(99,179,237,0.12)',
                                color: '#63b3ed',
                                border: '1px solid rgba(99,179,237,0.25)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Eye
                                size={10}
                                style={{ display: 'inline', marginRight: 3 }}
                              />{' '}
                              View
                            </button>
                            <button
                              onClick={() => handleComputeRisk(intern.id)}
                              disabled={computing}
                              style={{
                                background: 'rgba(167,139,250,0.12)',
                                color: '#a78bfa',
                                border: '1px solid rgba(167,139,250,0.25)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <RefreshCw
                                size={10}
                                style={{ display: 'inline', marginRight: 3 }}
                              />{' '}
                              Refresh
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(dashboardData?.interns?.data || []).length === 0 &&
                      !loading && (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              padding: '40px',
                              textAlign: 'center',
                              color: 'rgba(255,255,255,0.25)',
                              fontSize: '13px',
                            }}
                          >
                            No interns found. Adjust filters or ensure interns
                            are assigned to your team.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ALERTS TAB ===================== */}
      {activeTab === 'alerts' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Active Alerts
              {alertCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    fontSize: '11px',
                  }}
                >
                  {alertCount}
                </span>
              )}
            </h3>
            <button
              onClick={fetchAlerts}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {alertsLoading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              Loading alerts…
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <BellOff
                size={32}
                color="rgba(255,255,255,0.2)"
                style={{ marginBottom: '12px' }}
              />
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                No active alerts. All interns are within acceptable performance
                thresholds.
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.25)',
                  marginTop: '6px',
                }}
              >
                The system checks for risks automatically. Run a refresh on the
                dashboard to trigger detection.
              </div>
            </div>
          ) : (
            <div>
              {/* Group CRITICAL first */}
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => {
                const sevAlerts = alerts.filter((a) => a.severity === sev);
                if (sevAlerts.length === 0) return null;
                return (
                  <div key={sev} style={{ marginBottom: '18px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: SEVERITY_COLORS[sev],
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          background: `${SEVERITY_COLORS[sev]}18`,
                          border: `1px solid ${SEVERITY_COLORS[sev]}30`,
                          padding: '2px 8px',
                          borderRadius: '8px',
                        }}
                      >
                        {sev} — {sevAlerts.length}
                      </span>
                    </div>
                    {sevAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onAcknowledge={handleAcknowledge}
                        onResolve={handleResolve}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== INTERN DETAIL TAB ===================== */}
      {activeTab === 'intern' && selectedInternId && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Intern Risk Profile
              {internRisk?.full_name && (
                <span
                  style={{
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.5)',
                    marginLeft: 8,
                  }}
                >
                  — {internRisk.full_name}
                </span>
              )}
            </h3>
            <button
              onClick={() => handleComputeRisk(selectedInternId)}
              disabled={computing || internLoading}
              style={{
                background: 'rgba(139,92,246,0.18)',
                color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={12} />
              {computing ? 'Computing…' : 'Refresh Risk'}
            </button>
          </div>

          {internLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              Loading risk profile…
            </div>
          )}

          {internRisk?.error && (
            <div style={{ ...card, textAlign: 'center' }}>
              <Clock
                size={28}
                color="rgba(255,255,255,0.2)"
                style={{ marginBottom: '10px' }}
              />
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                {internRisk.error}
              </div>
              <button
                onClick={() => handleComputeRisk(selectedInternId)}
                style={{
                  marginTop: '12px',
                  background: 'rgba(139,92,246,0.2)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.35)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Compute Now
              </button>
            </div>
          )}

          {!internLoading && internRisk && !internRisk.error && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              {/* Risk Score Card */}
              <div
                style={{
                  ...card,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                <ScoreGauge score={internRisk.risk_score} size={90} />
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: '4px',
                    }}
                  >
                    RISK SCORE
                  </div>
                  <RiskBadge
                    level={internRisk.risk_level}
                    score={internRisk.risk_score}
                  />
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <TrendIcon direction={internRisk.trend_direction} />
                    <span style={{ textTransform: 'capitalize' }}>
                      {internRisk.trend_direction?.replace(/_/g, ' ')}
                    </span>
                    {Math.abs(internRisk.trend_change || 0) > 0 && (
                      <span
                        style={{
                          color:
                            internRisk.trend_change > 0 ? '#ef4444' : '#10b981',
                        }}
                      >
                        ({internRisk.trend_change > 0 ? '+' : ''}
                        {internRisk.trend_change})
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    Confidence:{' '}
                    <b style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {Math.round((internRisk.confidence || 0) * 100)}%
                    </b>{' '}
                    · Data:{' '}
                    <b style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {internRisk.data_quality}
                    </b>
                  </div>
                </div>
              </div>

              {/* Performance Score Card */}
              <div
                style={{
                  ...card,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                <ScoreGauge score={internRisk.performance_score} size={90} />
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: '4px',
                    }}
                  >
                    PERFORMANCE SCORE
                  </div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      color:
                        internRisk.performance_score >= 75
                          ? '#10b981'
                          : internRisk.performance_score >= 50
                            ? '#f59e0b'
                            : '#ef4444',
                    }}
                  >
                    {Math.round(internRisk.performance_score || 0)}
                    <span style={{ fontSize: '14px', fontWeight: 400 }}>
                      /100
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.55)',
                      marginTop: '4px',
                    }}
                  >
                    {internRisk.performance_level}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: '6px',
                    }}
                  >
                    Model: {internRisk.model_version}
                  </div>
                </div>
              </div>

              {/* Explainability Factors */}
              <div style={{ ...card, gridColumn: '1 / -1' }}>
                <h4
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    margin: '0 0 14px 0',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  Contributing Factors
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.35)',
                      marginLeft: '8px',
                    }}
                  >
                    Grounded in operational data only. No inferences from
                    protected attributes.
                  </span>
                </h4>
                {(internRisk.factors || []).length > 0 ? (
                  (internRisk.factors || []).map((f, i) => (
                    <FactorRow key={i} factor={f} />
                  ))
                ) : (
                  <div
                    style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}
                  >
                    No significant factors detected.
                  </div>
                )}
              </div>

              {/* Active Alerts */}
              {(internRisk.active_alerts || []).length > 0 && (
                <div style={{ ...card, gridColumn: '1 / -1' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      margin: '0 0 14px 0',
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    Active Alerts ({internRisk.active_alerts.length})
                  </h4>
                  {internRisk.active_alerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={handleAcknowledge}
                      onResolve={handleResolve}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}

              {/* Predictions */}
              {(internRisk.predictions || []).length > 0 && (
                <div style={{ ...card, gridColumn: '1 / -1' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      margin: '0 0 14px 0',
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    Predictive Indicators
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.35)',
                        marginLeft: '8px',
                      }}
                    >
                      Estimates only — not automated decisions. Verify with
                      direct mentor observation.
                    </span>
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(internRisk.predictions || []).map((pred, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                        }}
                      >
                        <div
                          style={{
                            width: '52px',
                            textAlign: 'center',
                            flexShrink: 0,
                            fontSize: '15px',
                            fontWeight: 800,
                            color:
                              pred.probability >= 0.7
                                ? '#ef4444'
                                : pred.probability >= 0.4
                                  ? '#f59e0b'
                                  : '#3b82f6',
                          }}
                        >
                          {Math.round(pred.probability * 100)}%
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'rgba(255,255,255,0.8)',
                            }}
                          >
                            {pred.label}
                          </div>
                          {pred.note && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.4)',
                                marginTop: '2px',
                              }}
                            >
                              {pred.note}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            marginLeft: 'auto',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.35)',
                            padding: '2px 7px',
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                          }}
                        >
                          {pred.type?.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Metadata */}
              <div
                style={{
                  ...card,
                  gridColumn: '1 / -1',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <span>Model: {internRisk.model_version}</span>
                  <span>Data Quality: {internRisk.data_quality}</span>
                  <span>Signals: {internRisk.signal_count}</span>
                  <span>Tasks: {internRisk.tasks_assigned}</span>
                  <span>Attendance Days: {internRisk.attendance_days}</span>
                  <span>Ratings: {internRisk.ratings_count}</span>
                  <span>
                    Computed:{' '}
                    {internRisk.computed_at
                      ? new Date(internRisk.computed_at).toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.2)',
                  }}
                >
                  ⚠️ Predictions are estimates based on operational data. They
                  are not automated disciplinary decisions. No protected
                  attributes are used as prediction features. Always verify with
                  direct mentor assessment.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #1e1e2e; color: white; }
      `}</style>
    </div>
  );
}
