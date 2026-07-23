import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload, CheckCircle2, XCircle, Play, Lock, Database, ShieldAlert, ShieldCheck, Cpu,
  Activity, User, Edit2, Users, Search, RefreshCw, LayoutDashboard, Brain, ScanLine,
  FileText, LogOut, Hash, Calendar, Globe, Plane, Car, CreditCard, Terminal,
  Sparkles, Fingerprint, ChevronRight, Clock, Save, Loader2, AlertCircle,
  Network, Cloud, Zap, Server, ArrowRight, Check, X
} from 'lucide-react';
import CoforgeLogoImage from './Coforge-logo-Coral-Blue.png';

const API_URL = process.env.REACT_APP_API_URL || '';

const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });

// The CSS media query in index.css cannot reach JS-driven motion, so scripted
// scrolling checks the same preference itself.
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ═══════════════════════════════════════════════════
//  CONFIDENCE RING — circular score, animates once on arrival
// ═══════════════════════════════════════════════════
const ConfidenceRing = ({ score, size = 44 }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#34d399' : score >= 70 ? '#fbbf24' : '#fb7185';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="confidence-ring" width={size} height={size} aria-hidden="true">
        {/* Track sits on the navy header, so it is tinted light rather than dark. */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular" style={{ color }}>{score}</span>
      <span className="sr-only">Extraction confidence {score} percent</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  AGENT CONSOLE — structured log stream
// ═══════════════════════════════════════════════════

// Log lines arrive as "[Scope] [Agent] message". Splitting the leading tags out
// lets them render as chips instead of being read as part of the sentence.
// A leading ✓/✗ is dropped from the rendered body: the coloured rail and text
// tone already carry that meaning, and the mono stack has no glyph for ✗ so it
// falls back to a mismatched capital X. Tone detection still reads the raw text.
const parseLog = (raw = '') => {
  const match = raw.match(/^\s*((?:\[[^\]]+\]\s*)+)([\s\S]*)$/);
  const strip = (s) => s.trim().replace(/^[✓✗×]\s*/, '');
  if (!match) return { tags: [], body: strip(raw) };
  return {
    tags: (match[1].match(/\[[^\]]+\]/g) || []).map(t => t.slice(1, -1).trim()),
    body: strip(match[2])
  };
};

// Five tones, not ten. Every line maps to one of: failure, success, model
// output, orchestration, or ordinary agent progress.
const TONES = {
  error:  { body: 'text-rose-300',    rail: 'bg-rose-400/70',    tag: 'text-rose-300/75'    },
  ok:     { body: 'text-emerald-300', rail: 'bg-emerald-400/70', tag: 'text-emerald-300/75' },
  ai:     { body: 'text-violet-300',  rail: 'bg-violet-400/70',  tag: 'text-violet-300/75'  },
  system: { body: 'text-slate-400',   rail: 'bg-slate-500/50',   tag: 'text-slate-500/75'   },
  info:   { body: 'text-sky-300',     rail: 'bg-sky-400/60',     tag: 'text-sky-300/75'     }
};

const toneOf = (log) => {
  const text = log.text || '';
  if (log.error || /✗|\bREJECTED\b|\bINVALID\b|\[Error\]|\bfailed\b/i.test(text)) return 'error';
  // Green is reserved for verdicts, not for routine progress. The backend marks
  // almost every step with a ✓, so treating that as success turned the whole
  // stream green and buried the decision that actually matters.
  if (/\bAPPROVED\b|\bVALID\b|processed successfully/i.test(text)) return 'ok';
  if (/\[(Groq AI|AI Agent|Gemini AI)\]/.test(text)) return 'ai';
  if (/\[(System|Orchestrator)/.test(text)) return 'system';
  return 'info';
};

const AgentConsole = ({ logs }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [logs]);

  const isIdle = logs.length === 0 || logs[logs.length - 1]?.text?.includes('Pipeline idle');

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] rounded-2xl overflow-hidden font-mono border border-slate-800/60 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 bg-[#10151d] border-b border-slate-800/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 text-[10px] font-semibold tracking-[0.18em] uppercase font-sans">
            Agent Console
          </span>
        </div>
        <div className="flex items-center gap-3">
          {logs.length > 0 && (
            <span className="text-[9px] font-medium text-slate-500 tabular">
              {logs.length} {logs.length === 1 ? 'event' : 'events'}
            </span>
          )}
          <span className="w-px h-3 bg-slate-700/70" />
          <div className="flex items-center gap-1.5">
            {/* The only looping element in this panel: it means the stream is live. */}
            <span className={`w-1.5 h-1.5 rounded-full ${isIdle ? 'bg-slate-600' : 'bg-emerald-400 loop-beacon'}`} />
            <span className={`text-[9px] font-bold tracking-[0.16em] font-sans ${isIdle ? 'text-slate-600' : 'text-emerald-400'}`}>
              {isIdle ? 'IDLE' : 'LIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2.5 py-2.5 dark-scrollbar" role="log" aria-live="polite" aria-label="Agent activity log">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 enter-fade">
            <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
              <Cpu className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-slate-500 text-[11px] font-sans font-medium">Awaiting pipeline initialisation</p>
            <p className="text-slate-700 text-[10px] font-sans mt-1">Agent output will stream here in real time</p>
          </div>
        ) : (
          <div className="space-y-px">
            {logs.map((log, i) => {
              const tone = TONES[toneOf(log)];
              const { tags, body } = parseLog(log.text);
              return (
                <div
                  key={i}
                  className="flex items-stretch gap-2.5 rounded-md px-1.5 py-[5px] enter-slide hover:bg-white/[0.03] transition-colors"
                >
                  {/* Some backend lines carry no timestamp; leave the column
                      blank rather than printing a placeholder clock. */}
                  <span className="w-[52px] shrink-0 select-none text-[10px] text-slate-600 tabular pt-px">
                    {log.time || ''}
                  </span>
                  <span className={`w-[2px] shrink-0 rounded-full ${tone.rail}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    {tags.map((tag, t) => (
                      <span key={t} className={`tag ${t === 0 && tags.length > 1 ? 'text-slate-600' : tone.tag}`}>
                        {tag}
                      </span>
                    ))}
                    <span className={`text-[11px] leading-relaxed break-words ${tone.body}`}>{body}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 h-8 bg-[#10151d] border-t border-slate-800/70 text-[9px] text-slate-600 flex items-center justify-between shrink-0 font-sans">
        <span className="tracking-wide truncate">Azure Blob Storage · Form Recognizer · Groq Llama 3.3</span>
        <span className="text-slate-700 shrink-0 ml-3">v2.0</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  PIPELINE NODE — one stage of the multi-agent run
// ═══════════════════════════════════════════════════
const PipelineNode = ({ icon: Icon, title, index, status, active }) => {
  const state =
    status === 'completed' ? 'done'
      : (status === 'invalid' || status === 'error') ? 'failed'
        : active ? 'busy' : 'idle';

  const shell = {
    done:   'bg-emerald-50 border-emerald-300 text-emerald-600',
    failed: 'bg-rose-50 border-rose-300 text-rose-600',
    // `loop-ring` is the single animation on this node — the icon never also
    // bounces, so nothing here animates twice.
    busy:   'bg-[#FFF3F0] border-[#F15840] text-[#F15840] loop-ring',
    idle:   'bg-white border-slate-200 text-slate-300'
  }[state];

  const caption = { done: 'Complete', failed: 'Failed', busy: 'Working', idle: 'Standby' }[state];
  const captionTone = {
    done: 'text-emerald-500', failed: 'text-rose-500', busy: 'text-[#F15840]', idle: 'text-slate-300'
  }[state];
  const titleTone = {
    done: 'text-emerald-700', failed: 'text-rose-700', busy: 'text-[#F15840]', idle: 'text-slate-400'
  }[state];

  return (
    <div className="relative z-10 flex flex-col items-center w-24">
      <div className={`relative w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 ${shell}`}>
        {state === 'done'
          ? <CheckCircle2 className="w-6 h-6 enter-pop" />
          : state === 'failed'
            ? <XCircle className="w-6 h-6 enter-pop" />
            : <Icon className="w-[22px] h-[22px]" />}
        <span className="absolute -top-1.5 -left-1.5 w-[18px] h-[18px] rounded-full bg-white border border-slate-200 text-[9px] font-bold text-slate-400 flex items-center justify-center tabular">
          {index}
        </span>
      </div>
      <p className={`text-[10px] font-bold text-center mt-2 uppercase tracking-[0.08em] transition-colors ${titleTone}`}>
        {title}
      </p>
      <span className={`text-[9px] font-semibold mt-0.5 transition-colors ${captionTone}`}>{caption}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  DOCUMENT VERDICT OVERLAY — one-shot verified / flagged stamp
//  Mounts the instant a single document reaches a terminal state, so its
//  entrance plays exactly once. Rendered per card, and since the pipeline
//  finishes documents sequentially, the three cards light up one at a time.
// ═══════════════════════════════════════════════════
const DocVerdictOverlay = ({ ok }) => (
  <div
    className={`absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none verdict-wash ${ok ? 'bg-emerald-500/12' : 'bg-rose-500/12'}`}
    role="status"
    aria-label={ok ? 'Document verified' : 'Document flagged'}
  >
    <div className="relative w-7 h-7">
      <span className={`absolute -inset-1 rounded-full border-2 verdict-ring ${ok ? 'border-emerald-400' : 'border-rose-400'}`} aria-hidden="true" />
      <div className={`absolute inset-0 rounded-full flex items-center justify-center shadow-md verdict-pop ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {ok ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : <X className="w-4 h-4 text-white" strokeWidth={3} />}
      </div>
    </div>
    <span className={`text-[8px] font-extrabold tracking-[0.14em] uppercase verdict-label ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
      {ok ? 'Verified' : 'Flagged'}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════
//  EXTRACTED DATA CARD
// ═══════════════════════════════════════════════════
const ExtractedDataCard = ({ data, docType, documentId, onRevalidate, agentProgress }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Filter out confidence and reasoning from display
  const displayData = useMemo(() => {
    return data ? Object.fromEntries(
      Object.entries(data).filter(([k, v]) => !['confidence_score', 'reasoning'].includes(k) && v && v !== '-')
    ) : {};
  }, [data]);

  const entries = Object.entries(displayData);

  useEffect(() => {
    setEditedData(displayData);
  }, [data, displayData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/update-data/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: editedData })
      });
      const result = await res.json();
      if (result.success) {
        setIsEditing(false);
        if (onRevalidate) onRevalidate();
      }
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
  };

  if (!data || entries.length === 0) return null;

  const docLabel = docType === 'driving_license' ? 'Driving License' : docType === 'passport' ? 'Passport' : 'ID Card';
  const confidence = data.confidence_score;
  const DocIcon = docType === 'passport' ? Plane : docType === 'driving_license' ? Car : CreditCard;
  const canEdit = agentProgress?.kycComplete?.status === 'invalid' && documentId;

  const getFieldIcon = (key) => {
    const k = key.toLowerCase();
    if (k.includes('date') || k.includes('birth') || k.includes('expiry') || k.includes('issue')) return Calendar;
    if (k.includes('number') || k.includes('no') || k.includes('dln') || k.includes('id')) return Hash;
    if (k.includes('name') || k.includes('surname') || k.includes('given')) return User;
    if (k.includes('national') || k.includes('country') || k.includes('place')) return Globe;
    return FileText;
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl overflow-hidden enter-fade">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#001f3f] via-[#002d5c] to-[#003a6b] px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <DocIcon className="w-4 h-4 text-white/80" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-xs tracking-wide truncate">Extracted Data</p>
            <p className="text-[9px] text-white/50 font-semibold uppercase tracking-[0.12em] mt-0.5">
              {docLabel} · {entries.length} fields
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {confidence && <ConfidenceRing score={confidence} size={40} />}
          {canEdit && (
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={isSaving}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[#F15840] text-white uppercase tracking-wide hover:bg-[#d44a35] disabled:opacity-60 transition-colors flex items-center gap-1.5"
            >
              {isEditing
                ? (isSaving ? <><Loader2 className="w-3 h-3 loop-spin" /> Saving</> : <><Save className="w-3 h-3" /> Save &amp; Re-verify</>)
                : <><Edit2 className="w-3 h-3" /> Correct</>}
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-auto p-3 custom-scrollbar bg-slate-50/40">
        <div className="grid grid-cols-2 gap-1.5 stagger">
          {entries.map(([key, value]) => {
            const FieldIcon = getFieldIcon(key);
            return (
              <div
                key={key}
                className="flex items-start gap-2.5 py-2 px-2.5 rounded-xl bg-white border border-slate-100 enter-fade hover:border-slate-200 hover:shadow-xs transition-all group"
              >
                <FieldIcon className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-1 group-hover:text-[#F15840]/70 transition-colors" />
                <div className="flex-1 min-w-0">
                  <span className="label block">{key.replace(/_/g, ' ')}</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData[key] || ''}
                      onChange={(e) => setEditedData({ ...editedData, [key]: e.target.value })}
                      className="text-[11px] text-slate-800 font-semibold font-mono bg-white border border-slate-300 rounded-md px-1.5 py-1 w-full focus:outline-none focus:border-[#F15840] focus:ring-2 focus:ring-[#F15840]/20 mt-1"
                      aria-label={key.replace(/_/g, ' ')}
                    />
                  ) : (
                    <span className="text-[11px] text-slate-800 font-semibold font-mono block truncate mt-0.5" title={String(value)}>
                      {value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  USER MANAGEMENT DASHBOARD
// ═══════════════════════════════════════════════════
const UserManagementDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      setUsers(data || []);
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const searchString = `${u['Given Name']} ${u['Surname']} ${u['Passport Number']} ${u['Driving License Number']} ${u['Identity Card Number']}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const approvedCount = users.filter(u => u['Verification Status'] === 'VALID').length;
  const rejectedCount = users.filter(u => u['Verification Status'] === 'INVALID').length;
  const pendingCount = users.length - approvedCount - rejectedCount;

  // Clean white tiles with a single accent band read as more considered than
  // four saturated gradient blocks competing for attention.
  const StatCard = ({ label, count, icon: SIcon, accent, tint }) => (
    <div className="relative bg-white rounded-2xl p-4 border border-slate-200/70 shadow-soft overflow-hidden enter-rise">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="label">{label}</p>
          <p className="text-[26px] leading-none font-extrabold text-[#001f3f] mt-2 tabular">{count}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}>
          <SIcon className="w-[18px] h-[18px]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col p-6 enter-fade">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#001f3f] tracking-tight">Audit &amp; Users</h2>
          <p className="text-slate-400 text-xs mt-1">KYC application history and agent council decisions</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or document ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F15840]/20 focus:border-[#F15840] w-72 bg-white shadow-xs transition-shadow"
              aria-label="Search users"
            />
          </div>
          <button
            onClick={fetchUsers}
            className="w-10 h-10 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-[#001f3f] transition-colors bg-white shadow-xs flex items-center justify-center"
            aria-label="Refresh audit log"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'loop-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger">
        <StatCard label="Total Applications" count={users.length} icon={Users} accent="bg-[#001f3f]" tint="bg-slate-100 text-[#001f3f]" />
        <StatCard label="Approved" count={approvedCount} icon={CheckCircle2} accent="bg-emerald-500" tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Rejected" count={rejectedCount} icon={XCircle} accent="bg-rose-500" tint="bg-rose-50 text-rose-600" />
        <StatCard label="Processing" count={pendingCount} icon={Activity} accent="bg-amber-500" tint="bg-amber-50 text-amber-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
                <th className="px-6 py-3.5 label">Customer</th>
                <th className="px-6 py-3.5 label">Document</th>
                <th className="px-6 py-3.5 label">ID Number</th>
                <th className="px-6 py-3.5 label">Decision</th>
                <th className="px-6 py-3.5 label text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400 text-xs">
                    <Loader2 className="w-5 h-5 loop-spin mx-auto mb-2.5 text-slate-300" />
                    Loading audit logs…
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-4 h-4 text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">No records found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchTerm ? 'Try a different search term' : 'Completed verifications will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, i) => {
                  const docType = user['Passport Number'] !== '-' ? 'Passport' :
                                  user['Driving License Number'] !== '-' ? 'Driving License' : 'Identity Card';
                  const idNum = user['Passport Number'] !== '-' ? user['Passport Number'] :
                                user['Driving License Number'] !== '-' ? user['Driving License Number'] : user['Identity Card Number'];
                  const status = user['Verification Status'];
                  const initials = `${(user['Given Name'] || '?')[0]}${(user['Surname'] || '?')[0]}`.toUpperCase();
                  const RowIcon = docType === 'Passport' ? Plane : docType === 'Driving License' ? Car : CreditCard;

                  return (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#001f3f] to-[#003a6b] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-[13px] truncate">{user['Given Name']} {user['Surname']}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.id ? user.id.split('-')[0] : 'Historical'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <RowIcon className="w-3 h-3 text-slate-400" />
                          {docType}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 tabular">{idNum}</td>
                      <td className="px-6 py-3.5">
                        <span className={`chip ${status === 'VALID' ? 'chip-ok' : status === 'INVALID' ? 'chip-bad' : 'chip-warn'}`}>
                          {status === 'VALID' && <CheckCircle2 className="w-3 h-3" />}
                          {status === 'INVALID' && <XCircle className="w-3 h-3" />}
                          {!['VALID', 'INVALID'].includes(status) && <Clock className="w-3 h-3" />}
                          {status === 'VALID' ? 'Approved' : status === 'INVALID' ? 'Rejected' : 'Processing'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-[#F15840] transition-colors uppercase tracking-wider">
                          Details <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  AGENT DEFINITIONS — single source of truth
//  Drives the Command Center pipeline strip, the Architecture diagram and the
//  roster, so the three views can never disagree about what the system is.
//  `stage` maps each agent onto the backend's progress payload keys; the roles
//  and services below match what app.py actually does (verified against the
//  live pipeline's log tags and the Groq / Azure / Redis / OFAC integrations).
// ═══════════════════════════════════════════════════
const ACCENT = {
  sky:     { text: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     ring: 'ring-sky-200'     },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  amber:   { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-200'   },
  violet:  { text: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  ring: 'ring-violet-200'  },
};

const AGENTS = [
  {
    id: 'vision', stage: 'agent1', index: 1, name: 'Vision Agent', short: 'Vision OCR',
    icon: ScanLine, accent: 'sky',
    role: 'Reads the document, classifies its type and extracts structured fields from the raw OCR text.',
    tools: ['Azure Blob', 'Form Recognizer', 'Groq Llama 3.3'],
    input: 'Document image', output: 'Structured fields + type',
    tool: { icon: Cloud, label: 'Azure Blob · Form Recognizer' },
  },
  {
    id: 'database', stage: 'agent2', index: 2, name: 'Database Agent', short: 'DB Agent',
    icon: Database, accent: 'emerald',
    role: 'Cross-references the extracted identity against the customer record store.',
    tools: ['Redis'],
    input: 'Extracted identity', output: 'Record match',
    tool: { icon: Server, label: 'Redis datastore' },
  },
  {
    id: 'compliance', stage: 'agent3', index: 3, name: 'Compliance Agent', short: 'Compliance',
    icon: ShieldAlert, accent: 'amber',
    role: 'Screens the applicant against the OFAC sanctions (SDN) watchlist.',
    tools: ['OFAC SDN'],
    input: 'Verified identity', output: 'Watchlist verdict',
    tool: { icon: ShieldAlert, label: 'OFAC SDN list' },
  },
  {
    id: 'orchestrator', stage: 'kycComplete', index: 4, name: 'Orchestrator Agent', short: 'Orchestrator',
    icon: Brain, accent: 'violet',
    role: 'Delegates to each agent, synthesises the final KYC decision and persists the outcome.',
    tools: ['Groq Llama 3.3', 'Redis'],
    input: 'All agent outputs', output: 'KYC decision',
    tool: { icon: Zap, label: 'Groq Llama 3.3 70B' },
  },
];

// Map a raw backend status onto the shared visual vocabulary.
const agentState = (status) =>
  status === 'completed' ? { label: 'Ready',    chip: 'chip-ok'      }
    : (status === 'invalid' || status === 'error') ? { label: 'Flagged', chip: 'chip-bad'   }
      : status === 'processing' ? { label: 'Working', chip: 'chip-warn' }
        : { label: 'Standby', chip: 'chip-neutral' };

// ═══════════════════════════════════════════════════
//  ARCHITECTURE VIEW — static system diagram + live agent roster
// ═══════════════════════════════════════════════════

// A node in the diagram tiers. `w-1/3` columns (rather than a gapped grid) give
// exact thirds, so the branch/drop connectors line up on every viewport width.
const DiagramAgent = ({ agent, status }) => {
  const a = ACCENT[agent.accent];
  const st = agentState(status);
  const Icon = agent.icon;
  return (
    <div className={`w-full max-w-[180px] rounded-xl border bg-white ${a.border} shadow-soft px-3 py-3 text-center`}>
      <div className={`w-10 h-10 mx-auto rounded-xl ${a.bg} ${a.text} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[12px] font-bold text-slate-800 mt-2">{agent.name}</p>
      <span className={`chip ${st.chip} mt-1.5`}>{st.label}</span>
    </div>
  );
};

const DiagramTool = ({ tool }) => {
  const Icon = tool.icon;
  return (
    <div className="w-full max-w-[180px] rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 flex items-center gap-2 justify-center">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-[10px] font-semibold text-slate-500 leading-tight text-center">{tool.label}</span>
    </div>
  );
};

// Exact thirds: no CSS gap (which would shift column centres); spacing comes
// from internal padding, so a column centre is always at 1/6, 1/2, 5/6.
const Third = ({ children }) => (
  <div className="w-1/3 flex justify-center px-1.5">{children}</div>
);

const ArchitectureView = ({ agentProgressMap }) => {
  const workers = AGENTS.filter(a => a.id !== 'orchestrator');
  // Reflect the most recently processed document, so after a run the roster
  // shows real per-agent outcomes instead of a permanently idle mock.
  const latest = Object.values(agentProgressMap).slice(-1)[0] || null;
  const statusFor = (stage) => latest?.[stage]?.status || 'idle';

  return (
    <div className="max-w-5xl mx-auto p-6 enter-fade">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#001f3f] tracking-tight">System Architecture</h2>
          <p className="text-slate-400 text-xs mt-1 max-w-lg">
            Four specialised agents, coordinated by an orchestrator — each backed by a dedicated cloud service.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-neutral"><Network className="w-3 h-3" /> 4 agents</span>
          <span className="chip chip-neutral"><Cpu className="w-3 h-3" /> Groq Llama 3.3 70B</span>
        </div>
      </div>

      {/* Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 sm:p-8 mb-6 overflow-x-auto">
        <div className="min-w-[540px] max-w-2xl mx-auto">

          {/* Tier caption */}
          <p className="label text-center mb-3">Coordinator</p>

          {/* Tier 1 — orchestrator */}
          <div className="flex justify-center">
            <div className="w-full max-w-md rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-soft px-4 py-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-[13px] font-extrabold text-slate-800">Orchestrator Agent</p>
                <p className="text-[11px] text-slate-500 leading-snug">Delegates to the agents · synthesises the KYC decision</p>
              </div>
            </div>
          </div>

          {/* Branch connector — stub, bus, three drops (all at exact thirds) */}
          <div className="relative h-9" aria-hidden="true">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 h-4 w-px bg-slate-300" />
            <div className="absolute top-4 h-px bg-slate-300" style={{ left: '16.6667%', right: '16.6667%' }} />
            {['16.6667%', '50%', '83.3333%'].map((l, i) => (
              <div key={i} className="absolute top-4 h-5 w-px bg-slate-300" style={{ left: l }} />
            ))}
          </div>

          <p className="label text-center mb-3">Agents</p>

          {/* Tier 2 — worker agents */}
          <div className="flex">
            {workers.map(a => (
              <Third key={a.id}><DiagramAgent agent={a} status={statusFor(a.stage)} /></Third>
            ))}
          </div>

          {/* Straight drops to the service tier */}
          <div className="flex" aria-hidden="true">
            {workers.map(a => (
              <div key={a.id} className="w-1/3 flex justify-center">
                <div className="w-px h-6 bg-slate-300" />
              </div>
            ))}
          </div>

          <p className="label text-center mb-3">Services &amp; tools</p>

          {/* Tier 3 — external services */}
          <div className="flex">
            {workers.map(a => (
              <Third key={a.id}><DiagramTool tool={a.tool} /></Third>
            ))}
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="label">Agent roster</h3>
        <span className="h-px flex-1 bg-slate-200/70" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
        {AGENTS.map(agent => {
          const a = ACCENT[agent.accent];
          const st = agentState(statusFor(agent.stage));
          const Icon = agent.icon;
          return (
            <div key={agent.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-soft p-4 enter-rise">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${a.bg} ${a.text} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-slate-800">{agent.name}</p>
                    <span className={`chip ${st.chip}`}>{st.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{agent.role}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.tools.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/70 rounded-md px-1.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="label shrink-0">In</span>
                <span className="truncate">{agent.input}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="label shrink-0">Out</span>
                <span className="truncate font-medium text-slate-600">{agent.output}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  MAIN APPLICATION
// ═══════════════════════════════════════════════════
const initialAgentProgress = {
  agent1: { name: "OCR Processing", progress: 0, status: "idle" },
  agent2: { name: "Data Validation", progress: 0, status: "idle" },
  agent3: { name: "OFAC Screening", progress: 0, status: "idle" },
  kycComplete: { name: "KYC Decision", progress: 0, status: "idle" }
};

const KYCPortal = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState('live_kyc');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [passportFile, setPassportFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({ passport: null, license: null, idCard: null });
  const [uploading, setUploading] = useState(false);

  const [agentLogs, setAgentLogs] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentDocIndex, setCurrentDocIndex] = useState(-1);
  const [activePollingId, setActivePollingId] = useState(null);
  const [activePollingKey, setActivePollingKey] = useState(null);
  const pollingRef = useRef(null);

  const [agentProgressMap, setAgentProgressMap] = useState({});
  const [extractedDataMap, setExtractedDataMap] = useState({});
  const [extractedDocTypeMap, setExtractedDocTypeMap] = useState({});
  // Retains each document's backend id after polling ends, so the "Correct"
  // action on a rejected document still has an id to post against.
  const [documentIdMap, setDocumentIdMap] = useState({});
  const [selectedDoc, setSelectedDoc] = useState('passport');


  const VALID_USERNAME = "shlok";
  const VALID_PASSWORD = "12345";

  // Handle sequential queue
  useEffect(() => {
    if (uploadQueue.length > 0 && currentDocIndex < uploadQueue.length && !activePollingId) {
      const startNextDoc = async () => {
        const item = uploadQueue[currentDocIndex];
        setSelectedDoc(item.key); // Auto-select the active tab
        setAgentLogs(prev => [...prev, { text: `[System] Starting KYC process for ${item.label}...`, time: now() }]);

        let docIdToPoll = null;
        if (item.file) {
          const formData = new FormData();
          formData.append('file', item.file);
          try {
            const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
              docIdToPoll = data.documentId;
              setAgentLogs(prev => [...prev, { text: `[System] ✓ ${item.label} uploaded — Initializing agents`, time: now() }]);
            } else {
              setAgentLogs(prev => [...prev, { text: `[Error] ✗ Failed to upload ${item.label}: ${data.message}`, time: now(), error: true }]);
            }
          } catch (e) {
            setAgentLogs(prev => [...prev, { text: `[Error] ✗ Network error uploading ${item.label}`, time: now(), error: true }]);
          }
        } else if (item.isDemo) {
          try {
            const res = await fetch(`${API_URL}/upload-demo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ docType: item.key })
            });
            const data = await res.json();
            if (data.success) {
              docIdToPoll = data.documentId;
            } else {
              setAgentLogs(prev => [...prev, { text: `[Error] ✗ Failed to load demo for ${item.label}`, time: now(), error: true }]);
            }
          } catch (e) {
            setAgentLogs(prev => [...prev, { text: `[Error] ✗ Network error loading demo`, time: now(), error: true }]);
          }
        }

        if (docIdToPoll) {
          setDocumentIdMap(prev => ({ ...prev, [item.key]: docIdToPoll }));
          setActivePollingId(docIdToPoll);
          setActivePollingKey(item.key);
        } else {
          // If it failed to upload/load, just skip to the next
          setCurrentDocIndex(prev => prev + 1);
        }
      };
      startNextDoc();
    } else if (uploadQueue.length > 0 && currentDocIndex >= uploadQueue.length) {
      setUploading(false);
      setAgentLogs(prev => {
        const hasRejection = prev.some(l => l.text.includes('KYC REJECTED'));
        const newLogs = [...prev];
        if (!hasRejection) {
          newLogs.push({ text: '[Orchestrator Agent] ✓ KYC APPROVED — All checks passed', time: now() });
        }
        newLogs.push({ text: '[System] ✓ All documents processed. Pipeline idle.', time: now() });
        return newLogs;
      });
      setUploadQueue([]);
      setCurrentDocIndex(-1);
    }
  }, [uploadQueue, currentDocIndex, activePollingId]);

  // Poll the backend for the *active* document only
  useEffect(() => {
    if (!activePollingId) return;


    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/process-logs/${activePollingId}`);
        const data = await res.json();

        if (data.logs) {
          // Only take new logs we haven't rendered for this doc yet
          const newLogs = data.logs.map(l => ({ ...l, text: `[${activePollingKey.toUpperCase()}] ${l.text}` }));
          setAgentLogs(prev => {
            // Keep the logs from previous docs + the newly polled logs for this doc
            const historicLogs = prev.filter(l => !l.text.includes(`[${activePollingKey.toUpperCase()}] `));
            return [...historicLogs, ...newLogs];
          });
        }

        if (data.progress) {
          setAgentProgressMap(prev => ({ ...prev, [activePollingKey]: data.progress }));
        }

        if (data.status === 'completed' || data.status === 'error') {
          const finalProgress = {
            agent1: { name: "OCR Processing", progress: 100, status: "completed" },
            agent2: { name: "Data Validation", progress: 100, status: (data.verification_status === 'VALID' || (data.verification_status === 'INVALID' && data.message?.includes('OFAC'))) ? "completed" : "invalid" },
            agent3: { name: "OFAC Screening", progress: 100, status: data.verification_status === 'VALID' ? "completed" : (data.message?.includes('OFAC') ? "invalid" : "idle"), message: data.message },
            kycComplete: { name: "KYC Decision", progress: 100, status: data.verification_status === 'VALID' ? "completed" : "invalid" }
          };
          setAgentProgressMap(prev => ({ ...prev, [activePollingKey]: finalProgress }));
          if (data.document_data) {
            setExtractedDataMap(prev => ({ ...prev, [activePollingKey]: data.document_data }));
            setExtractedDocTypeMap(prev => ({ ...prev, [activePollingKey]: data.document_type || 'unknown' }));
          }

          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setActivePollingId(null);
          setActivePollingKey(null);
          setCurrentDocIndex(prev => prev + 1); // Trigger next doc
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollingRef.current = setInterval(poll, 1500);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activePollingId, activePollingKey]);



  const handleLogin = () => {
    setAuthError('');
    if (name.trim() === VALID_USERNAME && password.trim() === VALID_PASSWORD) {
      setAuthenticated(true);
    } else {
      setAuthError('Invalid credentials. Please try again.');
    }
  };

  const handleFileSelect = (key, setter, file) => {
    setter(file);
    setPreviewUrls(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      return { ...prev, [key]: file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null };
    });
  };


  const initializePipeline = () => {
    setUploading(true);
    setAgentProgressMap({});
    setExtractedDataMap({});
    setExtractedDocTypeMap({});
    setDocumentIdMap({});
  };

  const handleUpload = () => {
    const filesToUpload = [];
    if (passportFile) filesToUpload.push({ key: 'passport', label: 'Passport', file: passportFile });
    if (licenseFile) filesToUpload.push({ key: 'license', label: 'Driving License', file: licenseFile });
    if (idCardFile) filesToUpload.push({ key: 'idCard', label: 'ID Card', file: idCardFile });

    if (filesToUpload.length === 0) return alert('Please upload at least one document');

    initializePipeline();
    setAgentLogs([{ text: `[System] KYC Pipeline initialized — ${filesToUpload.length} document(s) queued for sequential processing.`, time: now() }]);
    setUploadQueue(filesToUpload);
    setCurrentDocIndex(0);
  };

  const handleDemoUpload = () => {
    setPreviewUrls({ passport: '/demo-passport.png', license: '/demo-dl.png', idCard: '/demo-id.png' });
    initializePipeline();
    setAgentLogs([{ text: '[System] Demo mode — Loading sample documents for sequential processing...', time: now() }]);
    setUploadQueue([
      { key: 'passport', label: 'Passport', isDemo: true },
      { key: 'license', label: 'Driving License', isDemo: true },
      { key: 'idCard', label: 'ID Card', isDemo: true }
    ]);
    setCurrentDocIndex(0);
  };


  // Determine active agent based on logs
  let activeAgent = 0;
  if (uploading) {
    const lastLog = agentLogs[agentLogs.length - 1]?.text || "";
    if (lastLog.includes("[Form Recognizer]") || lastLog.includes("[Groq AI]") || lastLog.includes("[Azure Blob]") || lastLog.includes("[Gemini AI]") || lastLog.includes("[AI Agent]")) activeAgent = 1;
    else if (lastLog.includes("[Verification Agent]") || lastLog.includes("[Database]")) activeAgent = 2;
    else if (lastLog.includes("[OFAC Screening]")) activeAgent = 3;
    else if (lastLog.includes("[KYC Decision]")) activeAgent = 4;
    else activeAgent = 1;
  }

  // While a document is being processed the pipeline shows that document and
  // nothing else — deliberately with no fallback to another document's entry.
  // Falling back meant that in the gap between starting document 2 and its
  // first progress payload, the stages still displayed document 1's finished
  // state: four green "Complete" ticks beside a banner reading "Verifying…".
  // Reporting nothing yet (every stage on Standby) is the honest reading, and
  // it lets the pipeline visibly reset per document.
  const displayProgress = activePollingKey
    ? agentProgressMap[activePollingKey] || null
    : agentProgressMap[selectedDoc] || Object.values(agentProgressMap)[0] || null;

  // ═══════════════════════════════════════════════
  //  RENDER: LOGIN PAGE
  // ═══════════════════════════════════════════════
  if (!authenticated) {
    const capabilities = [
      { icon: ScanLine, title: 'Vision OCR extraction', desc: 'Azure Form Recognizer reads passports, licences and ID cards.' },
      { icon: Fingerprint, title: 'Identity cross-checks', desc: 'Extracted fields are reconciled against the customer record.' },
      { icon: ShieldCheck, title: 'Sanctions screening', desc: 'Every applicant is matched against the OFAC SDN list.' }
    ];

    return (
      <div className="min-h-screen flex font-sans">

        {/* Left: Hero — composed entirely from static gradients and a fixed grid.
            Nothing on this panel loops; the content animates in once and holds. */}
        <div className="hidden lg:flex flex-1 hero-canvas relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 hero-grid" aria-hidden="true" />

          <div className="relative z-10 w-full max-w-lg px-14 stagger">
            {/* The brand asset is coral-on-navy, so its darker half disappears
                against this panel — knock it back to a white wordmark. */}
            <img
              src={CoforgeLogoImage}
              alt="Coforge"
              className="h-10 w-auto mb-10 opacity-95 enter-rise [filter:brightness(0)_invert(1)]"
            />

            <div className="enter-rise">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff9d87] bg-[#F15840]/10 border border-[#F15840]/25 rounded-full px-3 py-1.5">
                <Sparkles className="w-3 h-3" />
                Multi-agent verification
              </span>
            </div>

            <h1 className="text-[38px] leading-[1.1] font-extrabold text-white tracking-tight mt-6 enter-rise">
              Agentic KYC
              <br />
              <span className="text-[#F15840]">Automation Pipeline</span>
            </h1>

            <p className="text-white/55 text-[13px] mt-4 leading-relaxed max-w-md enter-rise">
              An AI-driven multi-agent system for document verification, identity
              extraction and regulatory compliance screening — auditable end to end.
            </p>

            {/* Capabilities sit in normal document flow, so they can never
                overlap the headline the way absolutely-positioned icons did. */}
            {/* One entrance gesture for the whole block — the rows do not each
                carry their own animation, so nothing cascades out of order. */}
            <div className="mt-9 space-y-1 border-t border-white/10 pt-7 enter-rise">
              {capabilities.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/90 text-[12.5px] font-semibold">{title}</p>
                    <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Sign-in */}
        <div className="flex-1 flex items-center justify-center bg-[#fbfcfe] relative px-6">
          <div className="w-full max-w-sm enter-rise">

            <div className="lg:hidden mb-10">
              <img src={CoforgeLogoImage} alt="Coforge" className="h-9 w-auto" />
            </div>

            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F15840] to-[#ff7b5e] flex items-center justify-center shadow-[0_8px_24px_rgba(241,88,64,0.28)] mb-6">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-[26px] font-extrabold text-[#001f3f] tracking-tight">Welcome back</h2>
              <p className="text-[13px] text-slate-400 mt-1.5">Sign in to access the verification dashboard</p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <User className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Agent name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-11 pr-4 h-12 bg-white border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F15840]/25 focus:border-[#F15840] transition-all text-sm placeholder-slate-300 shadow-xs"
                  aria-label="Agent name"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-11 pr-4 h-12 bg-white border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F15840]/25 focus:border-[#F15840] transition-all text-sm placeholder-slate-300 shadow-xs"
                  aria-label="Password"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-[#F15840] to-[#ff7b5e] hover:from-[#d44a35] hover:to-[#e5684e] text-white font-bold h-12 rounded-xl transition-all shadow-[0_6px_20px_rgba(241,88,64,0.25)] hover:shadow-[0_10px_28px_rgba(241,88,64,0.35)] text-sm mt-1"
              >
                Sign in
              </button>
            </div>

            {authError && (
              <div className="mt-4 text-rose-600 text-[13px] text-center bg-rose-50 py-2.5 rounded-xl border border-rose-100 flex items-center justify-center gap-2 enter-fade" role="alert">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-slate-200/70 text-center">
              <p className="text-[11px] text-slate-400 mb-3">Evaluating this project?</p>
              <button
                onClick={() => setAuthenticated(true)}
                className="inline-flex items-center gap-2 text-[13px] font-bold text-[#F15840] hover:text-[#d44a35] transition-colors group"
              >
                <Play className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                <span className="underline underline-offset-4 decoration-[#F15840]/30">Open the recruiter view</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: MAIN DASHBOARD
  // ═══════════════════════════════════════════════
  const documents = [
    { key: 'passport', label: 'Passport', icon: Plane, file: passportFile, setter: setPassportFile, accent: 'from-sky-500 to-blue-600' },
    { key: 'license', label: 'License', icon: Car, file: licenseFile, setter: setLicenseFile, accent: 'from-emerald-500 to-teal-600' },
    { key: 'idCard', label: 'ID Card', icon: CreditCard, file: idCardFile, setter: setIdCardFile, accent: 'from-violet-500 to-purple-600' },
  ];
  const selectedCount = [passportFile, licenseFile, idCardFile].filter(Boolean).length;

  // Aggregate KYC decision — only approve when ALL docs pass
  const processedDocKeys = [passportFile, licenseFile, idCardFile].filter(Boolean).length > 0
    ? (passportFile ? ['passport'] : []).concat(licenseFile ? ['license'] : []).concat(idCardFile ? ['idCard'] : [])
    : ['passport', 'license', 'idCard']; // For demo mode
  const allDocsProcessed = processedDocKeys.length > 0 && processedDocKeys.every(k => {
    const p = agentProgressMap[k];
    return p?.kycComplete?.status === 'completed' || p?.kycComplete?.status === 'invalid';
  });
  const allDocsApproved = allDocsProcessed && processedDocKeys.every(k => agentProgressMap[k]?.kycComplete?.status === 'completed');
  const overallStatus = !allDocsProcessed ? (uploading ? 'processing' : 'idle') : (allDocsApproved ? 'approved' : 'rejected');

  const selDocData = extractedDataMap[selectedDoc];
  const selDocType = extractedDocTypeMap[selectedDoc];
  const selDocProgress = agentProgressMap[selectedDoc];

  const bannerTheme = {
    approved:   { shell: 'bg-emerald-50/80 border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-700', label: 'KYC Approved' },
    rejected:   { shell: 'bg-rose-50/80 border-rose-200',       icon: 'text-rose-500',    text: 'text-rose-700',    label: 'KYC Rejected' },
    processing: { shell: 'bg-amber-50/70 border-amber-200',     icon: 'text-amber-500',   text: 'text-amber-700',   label: 'Verifying…' },
    idle:       { shell: 'bg-white/80 border-slate-200',        icon: 'text-slate-300',   text: 'text-slate-400',   label: 'Awaiting documents' }
  }[overallStatus];

  return (
    <div className="h-screen w-screen app-canvas font-sans overflow-hidden flex flex-col text-slate-700">

      {/* ═══ NAVBAR ═══ */}
      <nav className="h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 flex items-center justify-between px-5 shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          <img src={CoforgeLogoImage} alt="Coforge" className="h-8 w-auto" />
          <span className="h-6 w-px bg-slate-200" />
          <span className="text-[#001f3f] font-extrabold tracking-[0.14em] text-[10px] uppercase">Agentic KYC Pipeline</span>
        </div>

        {/* Tab switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-slate-100/80 border border-slate-200/80 rounded-xl p-1">
          {[
            { id: 'live_kyc', label: 'Command Center', icon: LayoutDashboard },
            { id: 'architecture', label: 'Architecture', icon: Network },
            { id: 'user_management', label: 'Audit & Users', icon: Users }
          ].map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              aria-current={currentTab === id ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 h-8 rounded-lg text-[11px] font-bold transition-all ${
                currentTab === id
                  ? 'bg-white text-[#001f3f] shadow-soft'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            disabled={uploading || selectedCount === 0}
            className={`flex items-center gap-1.5 px-4 h-9 rounded-xl text-[11px] font-bold transition-all ${
              uploading || selectedCount === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-[#001f3f] text-white shadow-soft hover:bg-[#002d5c]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload &amp; Verify{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
          </button>
          <button
            onClick={handleDemoUpload}
            disabled={uploading}
            className="flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-[#F15840] to-[#ff7b5e] hover:from-[#d44a35] hover:to-[#e5684e] text-white rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Demo</span>
          </button>
          <span className="h-6 w-px bg-slate-200 mx-1" />
          <button
            onClick={() => setAuthenticated(false)}
            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-[#001f3f] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {currentTab === 'live_kyc' ? (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ═══ ROW 1: PIPELINE ═══ */}
          <div className="bg-white/80 backdrop-blur-xl mx-3 mt-3 rounded-2xl px-6 py-4 border border-slate-200/70 shadow-soft shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="label flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#F15840]" />
                Multi-agent processing pipeline
              </h3>
              {/* Static while running: the connector below already carries the
                  motion, so a second indicator here would just add noise. */}
              {uploading && (
                <span className="chip chip-warn">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Processing
                </span>
              )}
            </div>

            <div className="flex items-start justify-between px-4 w-full max-w-3xl mx-auto relative">
              {/* Connector rail */}
              <div className="absolute top-[28px] left-[52px] right-[52px] h-[2px] bg-slate-100 z-0" aria-hidden="true" />
              {uploading && (
                <svg
                  className="absolute top-[27px] left-[52px] z-0 overflow-visible"
                  style={{ width: 'calc(100% - 104px)', height: '4px' }}
                  aria-hidden="true"
                >
                  <line x1="0" y1="2" x2="100%" y2="2" stroke="#F15840" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" className="loop-flow" />
                </svg>
              )}
              {AGENTS.map(agent => {
                const status = displayProgress?.[agent.stage]?.status;
                // The orchestrator also counts as active once it holds any
                // non-idle status, since it renders the final verdict.
                const active = agent.id === 'orchestrator'
                  ? (activeAgent === 4 || (status && status !== 'idle'))
                  : activeAgent === agent.index;
                return (
                  <PipelineNode
                    key={agent.id}
                    icon={agent.icon}
                    title={agent.short}
                    index={agent.index}
                    status={status}
                    active={active}
                  />
                );
              })}
            </div>
          </div>

          {/* ═══ ROW 2: CONSOLE + DOCUMENTS ═══ */}
          <div className="flex-1 grid grid-cols-12 gap-3 px-3 pt-3 min-h-0 overflow-hidden">

            {/* LEFT: Agent console */}
            <div className="col-span-6 min-h-0">
              <AgentConsole logs={agentLogs} />
            </div>

            {/* RIGHT: Documents + extracted data */}
            {/* Panels stay side by side at every width: the shell is a fixed
                h-screen/overflow-hidden dashboard, so stacking would clip. */}
            <div className="col-span-6 flex flex-col gap-2.5 min-h-0">

              {/* Document slots */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                {documents.map(doc => {
                  const DocIcon = doc.icon;
                  const preview = previewUrls[doc.key];
                  const hasFile = doc.file || preview;
                  const dp = agentProgressMap[doc.key];
                  const isDocOk = dp?.kycComplete?.status === 'completed';
                  const isDocBad = dp?.kycComplete?.status === 'invalid';
                  const isSel = selectedDoc === doc.key;
                  const isScanning = uploading && activePollingKey === doc.key;

                  return (
                    <div
                      key={doc.key}
                      onClick={() => setSelectedDoc(doc.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedDoc(doc.key)}
                      aria-pressed={isSel}
                      className={`focusable rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border bg-white
                        ${isSel ? 'border-[#F15840] ring-2 ring-[#F15840]/15 shadow-card'
                          : isDocOk ? 'border-emerald-300 shadow-xs'
                            : isDocBad ? 'border-rose-300 shadow-xs'
                              : hasFile ? 'border-slate-200 hover:border-slate-300'
                                : 'border-dashed border-slate-200 hover:border-slate-300'}`}
                    >
                      {hasFile ? (
                        <div>
                          <div className={`bg-gradient-to-r ${doc.accent} px-2.5 h-7 flex items-center justify-between`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <DocIcon className="w-3 h-3 text-white/90 shrink-0" />
                              <span className="text-white font-bold text-[10px] tracking-wide truncate">{doc.label}</span>
                            </div>
                            {isDocOk && <CheckCircle2 className="w-3.5 h-3.5 text-white enter-pop shrink-0" />}
                            {isDocBad && <XCircle className="w-3.5 h-3.5 text-white enter-pop shrink-0" />}
                          </div>
                          <div className="relative h-[72px] bg-slate-50 flex items-center justify-center overflow-hidden">
                            {preview ? (
                              <img src={preview} alt={`${doc.label} preview`} className="h-full w-full object-contain" />
                            ) : (
                              // Non-image uploads (PDFs) have no object URL to show.
                              <div className="flex flex-col items-center text-slate-400">
                                <FileText className="w-5 h-5" />
                                <span className="text-[9px] font-semibold mt-1">Document ready</span>
                              </div>
                            )}
                            {isScanning && (
                              <div className="absolute inset-x-0 h-[2px] bg-[#F15840] shadow-[0_0_12px_#F15840] loop-sweep pointer-events-none" />
                            )}
                            {/* Verified / flagged stamp — plays once when this
                                document settles, and stays as the marker. */}
                            {!isScanning && (isDocOk || isDocBad) && <DocVerdictOverlay ok={isDocOk} />}
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-[100px] cursor-pointer group hover:bg-slate-50/80 transition-colors">
                          <Upload className="w-4 h-4 text-slate-300 group-hover:text-[#F15840] mb-2 transition-colors" />
                          <span className="text-[10px] text-slate-500 font-semibold">{doc.label}</span>
                          <span className="text-[9px] text-slate-300 mt-0.5">Click to add</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelect(doc.key, doc.setter, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extracted data */}
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200/70 shadow-soft bg-white">
                {selDocData ? (
                  <ExtractedDataCard
                    data={selDocData}
                    docType={selDocType}
                    documentId={documentIdMap[selectedDoc] || null}
                    onRevalidate={() => {}}
                    agentProgress={selDocProgress || initialAgentProgress}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">No extracted data yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Add a document or run the demo to begin</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ ROW 3: DECISION BANNER ═══
              Keyed on status so it plays its entrance once per state change and
              then holds — a settled verdict never keeps pulsing. */}
          <div
            key={overallStatus}
            className={`mx-3 mb-3 mt-2.5 rounded-2xl px-5 py-3 flex items-center justify-between gap-4 shrink-0 border enter-rise ${bannerTheme.shell}`}
            role="status"
          >
            <div className="flex items-center gap-3 min-w-0">
              {overallStatus === 'approved' && <CheckCircle2 className={`w-7 h-7 shrink-0 ${bannerTheme.icon}`} />}
              {overallStatus === 'rejected' && <XCircle className={`w-7 h-7 shrink-0 ${bannerTheme.icon}`} />}
              {overallStatus === 'processing' && <Cpu className={`w-7 h-7 shrink-0 ${bannerTheme.icon}`} />}
              {overallStatus === 'idle' && <ShieldAlert className={`w-7 h-7 shrink-0 ${bannerTheme.icon}`} />}
              <div className="min-w-0">
                <p className="label">Overall KYC decision</p>
                <p className={`text-[17px] font-extrabold tracking-tight mt-0.5 ${bannerTheme.text}`}>
                  {bannerTheme.label}
                </p>
              </div>
            </div>

            {/* Per-document verdicts */}
            {allDocsProcessed && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {processedDocKeys.map(k => {
                  const isOk = agentProgressMap[k]?.kycComplete?.status === 'completed';
                  const label = k === 'passport' ? 'Passport' : k === 'license' ? 'License' : 'ID Card';
                  return (
                    <span key={k} className={`chip ${isOk ? 'chip-ok' : 'chip-bad'}`}>
                      {isOk ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {label}
                    </span>
                  );
                })}
                <span className="text-[11px] font-bold text-slate-400 ml-1 tabular">
                  {processedDocKeys.filter(k => agentProgressMap[k]?.kycComplete?.status === 'completed').length}/{processedDocKeys.length} passed
                </span>
              </div>
            )}
          </div>
        </div>
      ) : currentTab === 'architecture' ? (
        <div className="flex-1 overflow-auto">
          <ArchitectureView agentProgressMap={agentProgressMap} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <UserManagementDashboard />
        </div>
      )}
    </div>
  );
};

export default KYCPortal;
