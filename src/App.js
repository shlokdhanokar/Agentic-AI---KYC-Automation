import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle, XCircle, Play, Lock, FileText, Database, ShieldAlert, Cpu, Activity, User, Edit2, MessageSquare, Send, Users, Search, RefreshCw, LayoutDashboard, Brain, Scan, Settings, Bot, Sparkles, Loader2
} from 'lucide-react';
import CoforgeLogoImage from './Coforge-logo-Coral-Blue.png';

const API_URL = process.env.REACT_APP_API_URL || '';

// === TERMINAL CONSOLE (stays dark - it's a terminal!) ===
const AgentConsole = ({ logs }) => {
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (log) => {
    const text = log.text || '';
    if (log.error) return 'text-red-400';
    if (text.includes('✓') || text.includes('APPROVED')) return 'text-emerald-400';
    if (text.includes('✗') || text.includes('REJECTED') || text.includes('INVALID')) return 'text-red-400';
    if (text.includes('[Groq AI]') || text.includes('[AI Agent]')) return 'text-fuchsia-400';
    if (text.includes('[Azure')) return 'text-sky-400';
    if (text.includes('[Form Recognizer]')) return 'text-amber-400';
    if (text.includes('[Database]')) return 'text-cyan-400';
    if (text.includes('[Verification')) return 'text-yellow-400';
    if (text.includes('[OFAC')) return 'text-orange-400';
    if (text.includes('[KYC')) return 'text-purple-400';
    return 'text-gray-300';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-2xl overflow-hidden font-mono text-xs shadow-xl border border-gray-200 relative">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-gray-700/50">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="ml-2 text-gray-400 text-xs font-semibold flex items-center tracking-wider">
            AGENT CONSOLE
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 text-[9px] font-bold tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {logs.length === 0 && (
          <div className="text-gray-600 italic flex items-center">
            Awaiting pipeline initialization...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start space-x-3 ${getLogColor(log)} animate-fade-in`}>
            <span className="text-gray-600 shrink-0 select-none">[{log.time || '--:--:--'}]</span>
            <span className="leading-relaxed">{log.text}</span>
          </div>
        ))}
        {logs.length > 0 && !logs[logs.length - 1]?.text?.includes('[KYC Decision]') && (
          <div className="text-gray-500 animate-pulse mt-2">▋</div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-1.5 bg-[#161b22] border-t border-gray-700/50 text-[9px] text-gray-600 tracking-wide">
        Powered by Azure Blob Storage • Azure Form Recognizer • Groq Llama 3.3
      </div>
    </div>
  );
};

// === INTERACTIVE PIPELINE NODE (Light Theme) ===
const PipelineNode = ({ icon: Icon, title, status, active }) => {
  const getStatusClasses = () => {
    if (status === 'completed') return 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/20';
    if (status === 'invalid' || status === 'error') return 'bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-500/20';
    if (active) return 'bg-[#FFF0ED] border-[#F15840] text-[#F15840] shadow-lg shadow-[#F15840]/25 animate-pulse-ring';
    return 'bg-gray-50 border-gray-200 text-gray-400';
  };

  return (
    <div className="flex flex-col items-center justify-center relative z-10 w-24">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${getStatusClasses()}`}>
        <Icon className={`w-6 h-6 ${active ? 'animate-bounce' : ''}`} />
      </div>
      <p className={`text-[10px] font-bold text-center mt-3 uppercase tracking-wider ${active ? 'text-[#F15840]' : status === 'completed' ? 'text-emerald-600' : status === 'invalid' ? 'text-red-600' : 'text-gray-400'}`}>
        {title}
      </p>
    </div>
  );
};


// === EXTRACTED DATA CARD WITH TYPEWRITER EFFECT ===
const ExtractedDataCard = ({ data, docType, documentId, onRevalidate, agentProgress }) => {
  const [visibleFields, setVisibleFields] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Filter out confidence and reasoning from display
  const displayData = data ? Object.fromEntries(
    Object.entries(data).filter(([k, v]) => !['confidence_score', 'reasoning'].includes(k) && v && v !== '-')
  ) : {};
  
  const entries = Object.entries(displayData);

  useEffect(() => {
    if (entries.length === 0) return;
    setVisibleFields(0);
    setEditedData(displayData);
    const timer = setInterval(() => {
      setVisibleFields(prev => {
        if (prev >= entries.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 150);
    return () => clearInterval(timer);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden shrink-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#001f3f] to-[#003a6b] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-white/80" />
          <span className="text-white font-semibold text-xs tracking-wide">Extracted Identity Data</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase">{docLabel}</span>
          

          {confidence && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confidence > 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              {confidence}% Confidence
            </span>
          )}
{agentProgress?.kycComplete?.status === 'invalid' && (
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={isSaving}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F15840] text-white uppercase hover:bg-[#d94a34] transition-colors flex items-center shadow-lg shadow-[#F15840]/30"
            >
              {isEditing ? (isSaving ? 'Saving...' : 'Save & Re-Verify') : <><Edit2 className="w-3 h-3 mr-1" /> Edit Data</>}
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="p-4 space-y-2">
        {entries.slice(0, visibleFields).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50/80 border border-gray-100 animate-fade-in">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{key}</span>
            {isEditing ? (
              <input 
                type="text" 
                value={editedData[key] || ''} 
                onChange={(e) => setEditedData({...editedData, [key]: e.target.value})}
                className="text-xs text-gray-800 font-semibold font-mono bg-white border border-blue-300 rounded px-2 py-0.5 w-1/2 focus:outline-none focus:border-[#F15840]"
              />
            ) : (
              <span className="text-xs text-gray-800 font-semibold font-mono">{value}</span>
            )}
          </div>
        ))}
        {visibleFields < entries.length && !isEditing && (
          <div className="flex items-center space-x-2 py-1.5 px-3">
            <div className="w-2 h-2 rounded-full bg-[#F15840] animate-pulse"></div>
            <span className="text-[10px] text-gray-400 font-mono">Extracting fields...</span>
          </div>
        )}
      </div>
    </div>
  );
};


// === USER MANAGEMENT DASHBOARD ===
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

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#001f3f] tracking-tight">User Management</h2>
          <p className="text-gray-500 text-sm mt-1">Audit log of all KYC applications and Agent Council decisions.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search users or IDs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F15840]/30 focus:border-[#F15840] w-64 shadow-sm"
            />
          </div>
          <button onClick={fetchUsers} className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-xl shadow-blue-900/5 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Document Type</th>
                <th className="px-6 py-4">ID Number</th>
                <th className="px-6 py-4">Agent Decision</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">Loading audit logs...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">No records found.</td>
                </tr>
              ) : (
                filteredUsers.map((user, i) => {
                  const docType = user['Passport Number'] !== '-' ? 'Passport' : 
                                  user['Driving License Number'] !== '-' ? 'Driving License' : 'Identity Card';
                  const idNum = user['Passport Number'] !== '-' ? user['Passport Number'] : 
                                user['Driving License Number'] !== '-' ? user['Driving License Number'] : user['Identity Card Number'];
                  const status = user['Verification Status'];
                  
                  return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{user['Given Name']} {user['Surname']}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{user.id ? user.id.split('-')[0] : 'Historical'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">{docType}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {idNum}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1.5 text-xs font-bold px-2.5 py-1 rounded-full
                          ${status === 'VALID' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : status === 'INVALID' ? 'bg-red-50 text-red-600 border border-red-200' 
                          : 'bg-yellow-50 text-yellow-600 border border-yellow-200'}`}>
                          {status === 'VALID' && <CheckCircle className="w-3.5 h-3.5" />}
                          {status === 'INVALID' && <XCircle className="w-3.5 h-3.5" />}
                          {!['VALID', 'INVALID'].includes(status) && <Activity className="w-3.5 h-3.5" />}
                          <span>{status === 'VALID' ? 'APPROVED' : status === 'INVALID' ? 'REJECTED' : 'PROCESSING'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[10px] font-bold text-[#003a6b] hover:text-[#F15840] transition-colors uppercase tracking-wider">
                          View Details &rarr;
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// === MAIN APPLICATION ===
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
  const [pollingDocIds, setPollingDocIds] = useState({});
  const pollingRef = useRef(null);

  const [agentProgressMap, setAgentProgressMap] = useState({});
  const [extractedDataMap, setExtractedDataMap] = useState({});
  const [extractedDocTypeMap, setExtractedDocTypeMap] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(null);


  const VALID_USERNAME = "shlok";
  const VALID_PASSWORD = "12345";

  // Poll the backend for processing logs
  useEffect(() => {
    const entries = Object.entries(pollingDocIds);
    if (entries.length === 0) return;

    const poll = async () => {
      let combinedLogs = [];
      let allDone = true;

      for (const [docKey, docId] of entries) {
        try {
          const res = await fetch(`${API_URL}/process-logs/${docId}`);
          const data = await res.json();
          if (data.logs) {
            const prefixed = entries.length > 1
              ? data.logs.map(l => ({ ...l, text: `[${docKey.toUpperCase()}] ${l.text}` }))
              : data.logs;
            combinedLogs = [...combinedLogs, ...prefixed];
          }
          if (data.status !== 'completed' && data.status !== 'error') {
            allDone = false;
            if (data.progress) {
                setAgentProgressMap(prev => ({ ...prev, [docKey]: data.progress }));
            }
          }
          if (data.status === 'completed' || data.status === 'error') {
            const finalProgress = {
              agent1: { name: "OCR Processing", progress: 100, status: "completed" },
              agent2: { name: "Data Validation", progress: 100, status: (data.verification_status === 'VALID' || (data.verification_status === 'INVALID' && data.message?.includes('OFAC'))) ? "completed" : "invalid" },
              agent3: { name: "OFAC Screening", progress: 100, status: data.verification_status === 'VALID' ? "completed" : (data.message?.includes('OFAC') ? "invalid" : "idle"), message: data.message },
              kycComplete: { name: "KYC Decision", progress: 100, status: data.verification_status === 'VALID' ? "completed" : "invalid" }
            };
            setAgentProgressMap(prev => ({ ...prev, [docKey]: finalProgress }));
            if (data.document_data) {
              setExtractedDataMap(prev => ({ ...prev, [docKey]: data.document_data }));
              setExtractedDocTypeMap(prev => ({ ...prev, [docKey]: data.document_type || 'unknown' }));
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }

      setAgentLogs(combinedLogs);

      if (allDone) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setUploading(false);
      }
    };

    pollingRef.current = setInterval(poll, 1500);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingDocIds]);

  
  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentDocId) return;
    
    const query = chatInput;
    setChatInput('');
    setIsChatting(true);
    
    // Add user message to logs locally first for immediate feedback
    setAgentLogs(prev => [...prev, { text: `[Human Agent] ${query}`, time: new Date().toLocaleTimeString(), color: 'text-blue-400' }]);
    
    try {
      const res = await fetch(`${API_URL}/agent-chat/${currentDocId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.success) {
        setAgentLogs(prev => [...prev, { text: `[AI Agent] ${data.answer}`, time: new Date().toLocaleTimeString(), color: 'text-fuchsia-400' }]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsChatting(false);
  };

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

  const handleFileRemove = (key, setter) => {
    setter(null);
    setPreviewUrls(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      return { ...prev, [key]: null };
    });
  };

  const initializePipeline = () => {
    setUploading(true);
    setAgentProgress({
      agent1: { name: "OCR Processing", status: "processing" },
      agent2: { name: "Data Validation", status: "idle" },
      agent3: { name: "OFAC Screening", status: "idle" },
      kycComplete: { name: "KYC Decision", status: "idle" }
    });
  };

  const handleUpload = async () => {
    const filesToUpload = [];
    if (passportFile) filesToUpload.push({ key: 'passport', label: 'Passport', file: passportFile });
    if (licenseFile) filesToUpload.push({ key: 'license', label: 'Driving License', file: licenseFile });
    if (idCardFile) filesToUpload.push({ key: 'idCard', label: 'ID Card', file: idCardFile });

    if (filesToUpload.length === 0) return alert('Please upload at least one document');

    initializePipeline();
    setAgentLogs([{ text: `[System] KYC Pipeline initialized \u2014 ${filesToUpload.length} document(s) queued`, time: new Date().toLocaleTimeString() }]);

    const newDocIds = {};

    for (const { key, label, file } of filesToUpload) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success && data.documentId) {
          newDocIds[key] = data.documentId;
          setAgentLogs(prev => [...prev, { text: `[System] \u2713 ${label} uploaded \u2014 Processing started`, time: new Date().toLocaleTimeString() }]);
        } else {
          setAgentLogs(prev => [...prev, { text: `[Error] \u2717 Failed to upload ${label}: ${data.message}`, time: new Date().toLocaleTimeString(), error: true }]);
        }
      } catch (error) {
        setAgentLogs(prev => [...prev, { text: `[Error] \u2717 Network error: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
      }
    }

    if (Object.keys(newDocIds).length > 0) {
      setPollingDocIds(newDocIds);
    } else {
      setUploading(false);
    }
  };

  const handleDemoUpload = async () => {
    setPreviewUrls({ passport: '/demo-passport.png', license: '/demo-dl.png', idCard: '/demo-id.png' });
    initializePipeline();
    setAgentLogs([{ text: '[System] Demo mode \u2014 Loading sample documents...', time: new Date().toLocaleTimeString() }]);

    const newDocIds = {};
    const docTypes = ['passport', 'license', 'idCard'];

    for (const docType of docTypes) {
      try {
        const response = await fetch(`${API_URL}/upload-demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType })
        });
        const data = await response.json();

        if (data.success && data.documentId) {
          newDocIds[docType] = data.documentId;
        } else {
          setAgentLogs(prev => [...prev, { text: `[Error] \u2717 ${data.message}`, time: new Date().toLocaleTimeString(), error: true }]);
        }
      } catch (error) {
        setAgentLogs(prev => [...prev, { text: `[Error] \u2717 Network error: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
      }
    }

    if (Object.keys(newDocIds).length > 0) {
      setPollingDocIds(newDocIds);
    } else {
      setUploading(false);
    }
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
  
  const displayProgress = Object.values(agentProgressMap)[0] || null;

  // === RENDER: LOGIN ===
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 flex flex-col relative overflow-hidden font-sans">
        {/* Subtle Coral/Blue Accent Blobs */}
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-[#F15840] rounded-full blur-[180px] opacity-[0.08]"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#003a6b] rounded-full blur-[200px] opacity-[0.08]"></div>

        <header className="p-6 relative z-10">
          <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-14 w-auto" />
        </header>

        <div className="flex-grow flex items-center justify-center px-4 relative z-10">
          <div className="bg-white/80 backdrop-blur-xl p-10 w-full max-w-md rounded-3xl shadow-2xl border border-white/50 relative overflow-hidden">
            {/* Top Gradient Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#003a6b] via-[#F15840] to-[#003a6b]"></div>

            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFF0ED] to-[#FFE0D9] border-2 border-[#F15840]/20 flex items-center justify-center shadow-lg shadow-[#F15840]/10">
                <Lock className="w-7 h-7 text-[#F15840]" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-[#001f3f] mb-1">
              KYC Verification Portal
            </h2>
            <p className="text-xs text-center text-gray-400 mb-8">
              Secure access to the Agentic KYC Pipeline
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Agent Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F15840]/40 focus:border-[#F15840] transition-all text-sm placeholder-gray-400"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F15840]/40 focus:border-[#F15840] transition-all text-sm placeholder-gray-400"
              />
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-[#F15840] to-[#ff7b5e] hover:from-[#d44a35] hover:to-[#e5684e] text-white font-semibold px-4 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 text-sm"
              >
                Login
              </button>
            </div>

            {authError && (
              <p className="mt-4 text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg border border-red-100 flex items-center justify-center">
                <ShieldAlert className="w-3.5 h-3.5 mr-2" /> {authError}
              </p>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-[10px] text-gray-400 mb-2">Evaluating this project?</p>
              <button onClick={() => setAuthenticated(true)} className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#F15840] hover:text-[#d44a35] transition-colors group">
                <Play className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                <span className="underline underline-offset-4">Click here for Recruiter View</span>
              </button>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-400 py-4 relative z-10">
          © 2025 Coforge. All rights reserved.
        </footer>
      </div>
    );
  }

  // === RENDER: DASHBOARD (SPLIT PANE — Light Theme) ===
  const documents = [
    { key: 'passport', label: 'Passport', icon: '\uD83D\uDEC2', file: passportFile, setter: setPassportFile, gradient: 'from-blue-500 to-indigo-600' },
    { key: 'license', label: 'Driving License', icon: '\uD83D\uDE97', file: licenseFile, setter: setLicenseFile, gradient: 'from-emerald-500 to-teal-600' },
    { key: 'idCard', label: 'ID Card', icon: '\uD83E\uDEAA', file: idCardFile, setter: setIdCardFile, gradient: 'from-purple-500 to-violet-600' },
  ];
  const selectedCount = [passportFile, licenseFile, idCardFile].filter(Boolean).length;

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 font-sans overflow-hidden flex flex-col text-gray-700">

      {/* Top Navbar — White Glassmorphism */}
      <nav className="h-16 bg-white/80 backdrop-blur-lg border-b border-gray-200/70 flex items-center justify-between px-6 shrink-0 relative z-50 shadow-sm">
        <div className="flex items-center space-x-4">
          <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-10 w-auto" />
          <div className="h-6 w-px bg-gray-200"></div>
          <span className="text-[#001f3f] font-bold tracking-wide text-sm">AGENTIC KYC PIPELINE</span>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Top Navigation */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-gray-50/80 backdrop-blur-md border border-gray-200 rounded-xl p-1 shadow-sm">
            <button 
              onClick={() => setCurrentTab('live_kyc')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${currentTab === 'live_kyc' ? 'bg-white text-[#003a6b] shadow border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> <span>Command Center</span>
            </button>
            <button 
              onClick={() => setCurrentTab('user_management')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${currentTab === 'user_management' ? 'bg-white text-[#003a6b] shadow border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Users className="w-4 h-4" /> <span>Audit & Users</span>
            </button>
          </div>
          

          <button
            onClick={handleDemoUpload}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-purple-500/20 hover:shadow-purple-500/30"
          >
            <Play className="w-3 h-3" /> <span>Run Demo</span>
          </button>
        </div>
      </nav>

      {/* Main Grid Workspace */}
      {currentTab === 'live_kyc' ? (
      <div className="flex-1 p-5 grid grid-cols-12 gap-5 h-[calc(100vh-4rem)] relative z-10 overflow-hidden">

        {/* LEFT PANE: Pipeline & Logs */}
        <div className="col-span-12 lg:col-span-7 flex flex-col space-y-5 h-full min-h-0">

          {/* Pipeline Telemetry Graph */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 relative flex flex-col justify-center h-48 border border-gray-200/80 shadow-sm shrink-0">
            <h3 className="absolute top-4 left-5 text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center">
              <Activity className="w-3 h-3 mr-2 text-[#F15840]" /> Pipeline Telemetry
            </h3>

            <div className="flex items-center justify-between mt-4 px-4 w-full max-w-2xl mx-auto relative">
              {/* Connecting Lines */}
              <div className="absolute top-7 left-12 right-12 h-0.5 bg-gray-200 z-0"></div>

              {/* Animated Flow Line */}
              {uploading && (
                <svg className="absolute top-7 left-12 right-12 h-1 z-0 overflow-visible" style={{ width: 'calc(100% - 96px)' }}>
                  <line x1="0" y1="0" x2="100%" y2="0" stroke="#F15840" strokeWidth="2" strokeDasharray="10 10" className="animate-dash" />
                </svg>
              )}

              <PipelineNode icon={Scan} title="Vision OCR Agent" status={displayProgress?.agent1?.status} active={activeAgent === 1} />
              <PipelineNode icon={Database} title="Database Agent" status={displayProgress?.agent2?.status} active={activeAgent === 2} />
              <PipelineNode icon={ShieldAlert} title="Compliance Agent" status={displayProgress?.agent3?.status} active={activeAgent === 3} />
              <PipelineNode icon={Brain} title="Orchestrator Agent" status={displayProgress?.kycComplete?.status} active={activeAgent === 4 || (displayProgress?.kycComplete?.status && displayProgress?.kycComplete?.status !== 'idle')} />
            </div>
          </div>


          {/* Agentic Chat UI */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-gray-200/80 shadow-sm shrink-0">
            <form onSubmit={handleChat} className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={currentDocId ? "Ask the AI Agent about this document..." : "Pipeline idle..."}
                disabled={!currentDocId || isChatting}
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-fuchsia-400 transition-all placeholder-gray-400"
              />
              <button 
                type="submit" 
                disabled={!currentDocId || isChatting || !chatInput.trim()}
                className="p-2.5 bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Terminal Console */}
          <div className="flex-1 min-h-0">
            <AgentConsole logs={agentLogs} />
          </div>
        </div>

        {/* RIGHT PANE: Documents & Status */}
        <div className="col-span-12 lg:col-span-5 flex flex-col h-full min-h-0 bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 flex items-center justify-between border-b border-gray-100 bg-white/80 shrink-0">
            <h3 className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center">
              <Upload className="w-3 h-3 mr-2 text-[#003a6b]" /> Document Pipeline
            </h3>
            {selectedCount > 0 && (
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#003a6b] border border-blue-200">
                {selectedCount}/3 processed
              </span>
            )}
          </div>
          
          {/* Scrollable Document List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-8 bg-gray-50/50">
            {documents.map(doc => {
              const hasFile = doc.file || previewUrls[doc.key];
              const docData = extractedDataMap[doc.key];
              const docProgress = agentProgressMap[doc.key];
              
              return (
                <div key={doc.key} className="space-y-4">
                  {/* Preview Card */}
                  <div className={`rounded-xl overflow-hidden transition-all duration-300 ${hasFile ? 'border-2 border-blue-300 shadow-md bg-white' : 'border-2 border-dashed border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'}`}>
                    {hasFile ? (
                      <div className="relative">
                        <div className={`bg-gradient-to-r ${doc.gradient} px-3 py-2 flex items-center justify-between`}>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{doc.icon}</span>
                            <span className="text-white font-semibold text-xs">{doc.label}</span>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">READY</span>
                        </div>
                        <div className="relative h-28 w-full bg-gray-50 flex justify-center group">
                          <img src={previewUrls[doc.key]} alt="preview" className="h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                          {uploading && activeAgent === 1 && (
                            <>
                              <div className="absolute inset-0 bg-[#F15840]/5 pointer-events-none"></div>
                              <div className="absolute w-full h-[2px] bg-[#F15840] shadow-[0_0_15px_#F15840,0_0_30px_#F15840] animate-scan-laser pointer-events-none"></div>
                            </>
                          )}
                          <button onClick={() => handleFileRemove(doc.key, doc.setter)} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors shadow-sm border border-gray-100">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 cursor-pointer group hover:bg-gray-50 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-[#FFF0ED] flex items-center justify-center mb-2 transition-colors">
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#F15840] transition-colors" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium group-hover:text-gray-700">{doc.label}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileSelect(doc.key, doc.setter, e.target.files?.[0])} />
                      </label>
                    )}
                  </div>

                  {/* Extracted Data Card */}
                  {docData && (
                    <ExtractedDataCard 
                      data={docData} 
                      docType={extractedDocTypeMap[doc.key]} 
                      documentId={pollingDocIds[doc.key]} 
                      onRevalidate={() => setPollingDocIds({[doc.key]: pollingDocIds[doc.key]})} 
                      agentProgress={docProgress || null} 
                    />
                  )}

                  {/* Final Decision Card */}
                  {docProgress?.kycComplete?.status && docProgress.kycComplete.status !== 'idle' && (
                    <div className={`rounded-xl p-5 border-2 flex flex-col shrink-0 shadow-sm transition-all duration-500
                      ${docProgress.kycComplete.status === 'completed'
                        ? 'bg-emerald-50 border-emerald-300'
                        : docProgress.kycComplete.status === 'invalid'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Final Decision</h4>
                          <div className="flex items-center space-x-2">
                            {docProgress.kycComplete.status === 'completed' && <CheckCircle className="w-6 h-6 text-emerald-500" />}
                            {docProgress.kycComplete.status === 'invalid' && <XCircle className="w-6 h-6 text-red-500" />}
                            <span className={`text-lg font-bold tracking-wide
                              ${docProgress.kycComplete.status === 'completed' ? 'text-emerald-600'
                              : docProgress.kycComplete.status === 'invalid' ? 'text-red-600' : 'text-gray-500'}`}>
                              {docProgress.kycComplete.status === 'completed' ? 'KYC APPROVED'
                              : docProgress.kycComplete.status === 'invalid' ? 'KYC REJECTED' : 'PROCESSING...'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {docProgress.agent3?.message && !docData?.reasoning && (
                        <p className="text-xs text-red-500 mt-1.5">{docProgress.agent3.message}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            <button
              onClick={handleUpload}
              disabled={uploading || selectedCount === 0}
              className={`mt-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center space-x-2 shrink-0
                ${uploading || selectedCount === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-gradient-to-r from-[#001f3f] to-[#003a6b] hover:from-[#002a54] hover:to-[#004a8b] text-white shadow-md hover:-translate-y-0.5'}`}
            >
              <Cpu className="w-4 h-4" />
              <span>{uploading ? 'Pipeline Active...' : `Upload & Verify${selectedCount > 0 ? ` (${selectedCount})` : ''}`}</span>
            </button>
          </div>
        </div>
      </div>
      ) : (
        <div className="flex-1 overflow-auto bg-[#fafafa]">
          <UserManagementDashboard />
        </div>
      )}
    </div>
  );
};

export default KYCPortal;
