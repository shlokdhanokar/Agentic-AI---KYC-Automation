import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle, XCircle, Terminal, Play, Lock, FileText, Database, ShieldAlert, Cpu
} from 'lucide-react';
import CoforgeLogoImage from './Coforge-logo-Coral-Blue.png';

const API_URL = process.env.REACT_APP_API_URL || '';

// === HACKER TERMINAL CONSOLE ===
const AgentConsole = ({ logs }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
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
    if (text.includes('[KYC')) return 'text-purple-400';
    return 'text-gray-300';
  };

  return (
    <div className="flex flex-col h-full glass-dark rounded-2xl overflow-hidden font-mono text-xs shadow-2xl border border-slate-700/50 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-purple-900/10 pointer-events-none"></div>
      
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-md relative z-10">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="ml-2 text-slate-300 text-xs font-semibold flex items-center tracking-wider">
            <Terminal className="w-3 h-3 mr-1.5" /> SYSTEM_TERMINAL
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 text-[9px] font-bold tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar relative z-10">
        {logs.length === 0 && (
          <div className="text-slate-500 italic flex items-center">
            <Cpu className="w-4 h-4 mr-2 animate-pulse" /> Awaiting pipeline initialization...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start space-x-3 ${getLogColor(log)} animate-fade-in`}>
            <span className="text-slate-600 shrink-0 select-none">[{log.time || '--:--:--'}]</span>
            <span className="leading-relaxed drop-shadow-md">{log.text}</span>
          </div>
        ))}
        {logs.length > 0 && !logs[logs.length - 1]?.text?.includes('[KYC Decision]') && (
          <div className="text-slate-500 animate-pulse mt-2">▋</div>
        )}
      </div>
    </div>
  );
};

// === INTERACTIVE PIPELINE NODE ===
const PipelineNode = ({ icon: Icon, title, status, active }) => {
  const getStatusClasses = () => {
    if (status === 'completed') return 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    if (status === 'invalid' || status === 'error') return 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
    if (active) return 'bg-[#F15840]/20 border-[#F15840] text-[#F15840] shadow-[0_0_20px_rgba(241,88,64,0.4)] animate-pulse-ring relative';
    return 'bg-slate-800/50 border-slate-700 text-slate-500';
  };

  return (
    <div className="flex flex-col items-center justify-center relative z-10 w-24">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all duration-500 backdrop-blur-md ${getStatusClasses()}`}>
        <Icon className={`w-6 h-6 ${active ? 'animate-bounce' : ''}`} />
      </div>
      <p className={`text-[10px] font-bold text-center mt-3 uppercase tracking-wider ${active ? 'text-white glow-text' : 'text-slate-400'}`}>
        {title}
      </p>
    </div>
  );
};

// === MAIN APPLICATION ===
const KYCPortal = () => {
  const [authenticated, setAuthenticated] = useState(false);
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

  const [agentProgress, setAgentProgress] = useState(null);

  const VALID_USERNAME = "shlok";
  const VALID_PASSWORD = "12345";

  // Poll the backend for processing logs
  useEffect(() => {
    const entries = Object.entries(pollingDocIds);
    if (entries.length === 0) return;

    const poll = async () => {
      let combinedLogs = [];
      let allDone = true;
      let latestResult = null;

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
          }
          if (data.status === 'completed' || data.status === 'error') {
            latestResult = data;
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

        if (latestResult && latestResult.status === 'completed') {
          setAgentProgress({
            agent1: { name: "OCR Processing", progress: 100, status: "completed" },
            agent2: { name: "Data Validation", progress: 100, status: (latestResult.verification_status === 'VALID' || (latestResult.verification_status === 'INVALID' && latestResult.message?.includes('OFAC'))) ? "completed" : "invalid" },
            agent3: { name: "OFAC Screening", progress: 100, status: latestResult.verification_status === 'VALID' ? "completed" : (latestResult.message?.includes('OFAC') ? "invalid" : "idle"), message: latestResult.message },
            kycComplete: { name: "KYC Decision", progress: latestResult.kyc_completed ? 100 : 100, status: latestResult.verification_status === 'VALID' ? "completed" : "invalid" }
          });
        }
      }
    };

    pollingRef.current = setInterval(poll, 1500);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingDocIds]);

  const handleLogin = () => {
    setAuthError('');
    if (name.trim() === VALID_USERNAME && password.trim() === VALID_PASSWORD) {
      setAuthenticated(true);
    } else {
      setAuthError('Invalid credentials. Access Denied.');
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
    setAgentLogs([{ text: `[System] Command Center initialized — ${filesToUpload.length} document(s) in queue`, time: new Date().toLocaleTimeString() }]);

    const newDocIds = {};

    for (const { key, label, file } of filesToUpload) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success && data.documentId) {
          newDocIds[key] = data.documentId;
          setAgentLogs(prev => [...prev, { text: `[System] ✓ ${label} ingested — Agent routing initiated`, time: new Date().toLocaleTimeString() }]);
        } else {
          setAgentLogs(prev => [...prev, { text: `[Error] ✗ Failed to ingest ${label}: ${data.message}`, time: new Date().toLocaleTimeString(), error: true }]);
        }
      } catch (error) {
        setAgentLogs(prev => [...prev, { text: `[Error] ✗ Network error: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
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
    setAgentLogs([{ text: '[System] Demo mode activated — Injecting synthetic payload...', time: new Date().toLocaleTimeString() }]);

    const newDocIds = {};
    const docTypes = ['license']; 
    
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
          setAgentLogs(prev => [...prev, { text: `[Error] ✗ ${data.message}`, time: new Date().toLocaleTimeString(), error: true }]);
        }
      } catch (error) {
        setAgentLogs(prev => [...prev, { text: `[Error] ✗ Network error: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
      }
    }
    
    if (Object.keys(newDocIds).length > 0) {
      setPollingDocIds(newDocIds);
    } else {
      setUploading(false);
    }
  };

  // Determine active agent based on logs
  let activeAgent = 0; // 0=none, 1=OCR, 2=Validation, 3=OFAC, 4=Done
  if (uploading) {
    const lastLog = agentLogs[agentLogs.length - 1]?.text || "";
    if (lastLog.includes("[Form Recognizer]") || lastLog.includes("[Groq AI]") || lastLog.includes("[Azure Blob]")) activeAgent = 1;
    else if (lastLog.includes("[Verification Agent]") || lastLog.includes("[Database]")) activeAgent = 2;
    else if (lastLog.includes("[OFAC Screening]")) activeAgent = 3;
    else if (lastLog.includes("[KYC Decision]")) activeAgent = 4;
    else activeAgent = 1;
  }

  // === RENDER: LOGIN ===
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#050B14] flex flex-col relative overflow-hidden font-sans">
        {/* Animated Background Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F15840] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#004a8b] rounded-full blur-[200px] opacity-30"></div>
        
        <header className="p-6 relative z-10 flex justify-center w-full">
          <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-16 w-auto brightness-0 invert opacity-90" />
        </header>

        <div className="flex-grow flex items-center justify-center px-4 relative z-10">
          <div className="glass-dark p-10 w-full max-w-md rounded-3xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-[#F15840] to-purple-500"></div>
            
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-lg">
                <Lock className="w-8 h-8 text-[#F15840]" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-wide">
              KYC Command Center
            </h2>
            <p className="text-xs text-center text-slate-400 mb-8 uppercase tracking-widest">
              Authorized Personnel Only
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="AGENT_ID"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-[#F15840] transition-colors placeholder-slate-600 font-mono text-sm"
                />
              </div>
              <div className="relative">
                <input
                  type="password"
                  placeholder="PASSPHRASE"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-[#F15840] transition-colors placeholder-slate-600 font-mono text-sm"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-[#F15840] hover:bg-[#ff6a53] text-white font-bold px-4 py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(241,88,64,0.3)] hover:shadow-[0_0_30px_rgba(241,88,64,0.5)] uppercase tracking-wider text-sm mt-4"
              >
                Authenticate
              </button>
            </div>

            {authError && (
              <p className="mt-5 text-[#ff4a4a] text-xs font-mono text-center flex items-center justify-center bg-red-900/20 py-2 rounded-lg border border-red-900/50">
                <ShieldAlert className="w-3 h-3 mr-2" /> {authError}
              </p>
            )}

            <div className="mt-8 pt-6 border-t border-slate-800 text-center">
               <button onClick={() => setAuthenticated(true)} className="text-[10px] text-slate-500 hover:text-white transition-colors font-mono uppercase tracking-widest underline decoration-slate-700 underline-offset-4">
                 [ Bypass for Demo Evaluation ]
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === RENDER: DASHBOARD (SPLIT PANE) ===
  const documents = [
    { key: 'passport', label: 'Passport', file: passportFile, setter: setPassportFile },
    { key: 'license', label: 'Driving License', file: licenseFile, setter: setLicenseFile },
    { key: 'idCard', label: 'ID Card', file: idCardFile, setter: setIdCardFile },
  ];
  const selectedCount = [passportFile, licenseFile, idCardFile].filter(Boolean).length;

  return (
    <div className="h-screen w-screen bg-[#050B14] font-sans overflow-hidden flex flex-col text-slate-300">
      {/* Top Navbar */}
      <nav className="h-16 glass-dark border-b border-slate-800 flex items-center justify-between px-6 shrink-0 relative z-50">
        <div className="flex items-center space-x-4">
          <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-10 w-auto brightness-0 invert opacity-90" />
          <div className="h-6 w-px bg-slate-700"></div>
          <span className="text-white font-semibold tracking-wider text-sm">AGENTIC KYC PIPELINE</span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleDemoUpload}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 rounded-lg text-xs font-bold transition-all disabled:opacity-50 uppercase tracking-widest"
          >
            <Play className="w-3 h-3" /> <span>Run Demo Payload</span>
          </button>
        </div>
      </nav>

      {/* Main Grid Workspace */}
      <div className="flex-1 p-6 grid grid-cols-12 gap-6 h-[calc(100vh-4rem)] relative z-10">
        
        {/* LEFT PANE: Pipeline & Logs */}
        <div className="col-span-12 lg:col-span-7 flex flex-col space-y-6 h-full">
          
          {/* Top: Architecture / Agent Graph */}
          <div className="glass-dark rounded-2xl p-6 relative flex flex-col justify-center h-48 border border-slate-800">
            <h3 className="absolute top-4 left-5 text-[10px] text-slate-500 font-bold tracking-widest uppercase flex items-center">
              <Activity className="w-3 h-3 mr-2" /> Pipeline Telemetry
            </h3>
            
            <div className="flex items-center justify-between mt-4 px-4 w-full max-w-2xl mx-auto relative">
              {/* Connecting Lines */}
              <div className="absolute top-7 left-12 right-12 h-0.5 bg-slate-800 z-0"></div>
              
              {/* Animated Flow Line */}
              {uploading && (
                <svg className="absolute top-7 left-12 right-12 h-1 z-0 overflow-visible" style={{ width: 'calc(100% - 96px)' }}>
                  <line x1="0" y1="0" x2="100%" y2="0" stroke="#F15840" strokeWidth="2" strokeDasharray="10 10" className="animate-dash glow-text" />
                </svg>
              )}

              <PipelineNode icon={FileText} title="Extraction" status={agentProgress?.agent1?.status} active={activeAgent === 1} />
              <PipelineNode icon={Database} title="Validation" status={agentProgress?.agent2?.status} active={activeAgent === 2} />
              <PipelineNode icon={ShieldAlert} title="OFAC" status={agentProgress?.agent3?.status} active={activeAgent === 3} />
              <PipelineNode icon={CheckCircle} title="Decision" status={agentProgress?.kycComplete?.status} active={activeAgent === 4 || agentProgress?.kycComplete?.status} />
            </div>
          </div>

          {/* Bottom: Terminal */}
          <div className="flex-1 min-h-0">
            <AgentConsole logs={agentLogs} />
          </div>
        </div>

        {/* RIGHT PANE: Documents & Status */}
        <div className="col-span-12 lg:col-span-5 flex flex-col space-y-6 h-full">
          
          {/* Upload / Preview Area */}
          <div className="glass-dark rounded-2xl p-6 flex flex-col flex-1 min-h-0 border border-slate-800">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-[10px] text-slate-500 font-bold tracking-widest uppercase flex items-center">
                <Upload className="w-3 h-3 mr-2" /> Data Ingestion
              </h3>
              {selectedCount > 0 && (
                <span className="text-[9px] font-bold px-2 py-1 rounded bg-[#F15840]/20 text-[#F15840] border border-[#F15840]/50 uppercase">
                  {selectedCount} Loaded
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {documents.map(doc => {
                const hasFile = doc.file || previewUrls[doc.key];
                return (
                  <div key={doc.key} className={`rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 transition-all ${hasFile ? 'border-blue-500/30' : 'hover:border-slate-600'}`}>
                    {hasFile ? (
                      <div className="relative h-32 w-full group bg-slate-950 flex justify-center">
                         <img src={previewUrls[doc.key]} alt="preview" className="h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                         
                         {/* Laser Scanning Effect */}
                         {uploading && activeAgent === 1 && (
                           <>
                             <div className="absolute inset-0 bg-blue-500/10 pointer-events-none"></div>
                             <div className="absolute w-full h-[2px] bg-[#F15840] shadow-[0_0_15px_#F15840] animate-scan-laser pointer-events-none"></div>
                           </>
                         )}

                         <button onClick={() => handleFileRemove(doc.key, doc.setter)} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-md text-white transition-colors">
                           <XCircle className="w-4 h-4" />
                         </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 cursor-pointer group">
                        <Upload className="w-6 h-6 text-slate-600 group-hover:text-[#F15840] transition-colors mb-2" />
                        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider group-hover:text-slate-300">{doc.label}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileSelect(doc.key, doc.setter, e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || selectedCount === 0}
              className={`mt-4 w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center space-x-2 shrink-0
                ${uploading || selectedCount === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                  : 'bg-[#003a6b] hover:bg-[#004a8b] text-white shadow-[0_0_20px_rgba(0,58,107,0.5)] border border-blue-400/30 glow-text'}`}
            >
              <Cpu className="w-4 h-4" />
              <span>{uploading ? 'PIPELINE ACTIVE' : 'INITIALIZE PIPELINE'}</span>
            </button>
          </div>

          {/* Verification Status Card */}
          {agentProgress?.kycComplete?.status && (
            <div className={`rounded-2xl p-6 border flex items-center justify-between shrink-0 shadow-2xl transition-all duration-500
              ${agentProgress.kycComplete.status === 'completed' 
                ? 'bg-emerald-900/30 border-emerald-500/50' 
                : agentProgress.kycComplete.status === 'invalid'
                ? 'bg-red-900/30 border-red-500/50'
                : 'bg-slate-800 border-slate-700'}`}>
              <div>
                <h4 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Final Decision</h4>
                <div className="flex items-center space-x-2">
                   {agentProgress.kycComplete.status === 'completed' && <CheckCircle className="w-6 h-6 text-emerald-500" />}
                   {agentProgress.kycComplete.status === 'invalid' && <XCircle className="w-6 h-6 text-red-500" />}
                   <span className={`text-xl font-bold tracking-wide
                     ${agentProgress.kycComplete.status === 'completed' ? 'text-emerald-400' 
                     : agentProgress.kycComplete.status === 'invalid' ? 'text-red-400' : 'text-slate-300'}`}>
                     {agentProgress.kycComplete.status === 'completed' ? 'APPROVED' 
                     : agentProgress.kycComplete.status === 'invalid' ? 'REJECTED' : 'AWAITING...'}
                   </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KYCPortal;
