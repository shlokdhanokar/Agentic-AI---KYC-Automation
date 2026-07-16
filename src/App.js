import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, AlertCircle, CheckCircle, XCircle, Eye, Clock,
  Home, Activity, Bell, Terminal, Play
} from 'lucide-react';
import CoforgeLogoImage from './Coforge-logo-Coral-Blue.png';

const API_URL = process.env.REACT_APP_API_URL || '';

// === REUSABLE COMPONENTS ===

const TabButton = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-left font-medium text-sm tracking-wide
    ${active
      ? 'bg-gradient-to-r from-[#F15840] to-[#ff7b5e] text-white shadow-lg shadow-orange-500/30'
      : 'text-[#a0b8cc] hover:bg-white/10 hover:text-white'}`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

const ActionCard = ({ icon: Icon, title, description, color, onClick }) => (
  <div
    onClick={onClick}
    className={`p-5 rounded-xl shadow-md cursor-pointer bg-white border-l-4 ${color} transform transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
  >
    <div className="flex items-center space-x-3 mb-2">
      <Icon className="w-5 h-5 text-gray-500" />
      <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
    </div>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
);

// === AGENT CONSOLE SIDE PANEL ===

const AgentConsole = ({ logs, visible, onClose }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!visible) return null;

  const getLogColor = (log) => {
    const text = log.text || '';
    if (log.error) return 'text-red-400';
    if (text.includes('✓') || text.includes('APPROVED')) return 'text-emerald-400';
    if (text.includes('✗') || text.includes('REJECTED') || text.includes('INVALID')) return 'text-red-400';
    if (text.includes('[Gemini AI]') || text.includes('[AI Agent]')) return 'text-purple-400';
    if (text.includes('[Azure')) return 'text-sky-400';
    if (text.includes('[Form Recognizer]')) return 'text-amber-400';
    if (text.includes('[Database]')) return 'text-cyan-400';
    if (text.includes('[Verification')) return 'text-yellow-400';
    if (text.includes('[KYC')) return 'text-pink-400';
    return 'text-gray-300';
  };

  return (
    <div className="w-[420px] bg-[#0d1117] border-l border-gray-800 flex flex-col font-mono text-xs shadow-2xl">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer hover:brightness-125" onClick={onClose}></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="ml-2 text-gray-400 text-xs font-medium flex items-center">
            <Terminal className="w-3 h-3 mr-1" /> Agent Console
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 text-[10px]">LIVE</span>
        </div>
      </div>

      {/* Console Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {logs.length === 0 && (
          <div className="text-gray-600 italic">Waiting for processing to start...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start space-x-2 ${getLogColor(log)} animate-fade-in`}>
            <span className="text-gray-600 shrink-0">{log.time || '--:--:--'}</span>
            <span className="leading-relaxed">{log.text}</span>
          </div>
        ))}
        {logs.length > 0 && !logs[logs.length - 1]?.text?.includes('[KYC Decision]') && (
          <div className="text-gray-500 animate-pulse">▋</div>
        )}
      </div>

      {/* Console Footer */}
      <div className="px-4 py-2 bg-[#161b22] border-t border-gray-800 text-[10px] text-gray-600">
        Powered by Azure Blob Storage • Azure Form Recognizer • Google Gemini AI
      </div>
    </div>
  );
};

// === MAIN APPLICATION ===

const KYCPortal = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [passportFile, setPassportFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({ passport: null, license: null, idCard: null });
  // eslint-disable-next-line no-unused-vars
  const [validationResults, setValidationResults] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Agent Console state
  const [showConsole, setShowConsole] = useState(false);
  const [agentLogs, setAgentLogs] = useState([]);
  const [pollingDocIds, setPollingDocIds] = useState({});
  const pollingRef = useRef(null);

  const [agentProgress, setAgentProgress] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [alerts, setAlerts] = useState([]);

  const VALID_USERNAME = "shlok";
  const VALID_PASSWORD = "12345";

  // Poll the backend for processing logs (supports multiple document IDs)
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
            agent1: { name: "Document Processing", progress: 100, status: "completed" },
            agent2: { name: "Validation", progress: 100, status: (latestResult.verification_status === 'VALID' || (latestResult.verification_status === 'INVALID' && latestResult.message?.includes('OFAC'))) ? "completed" : "invalid" },
            agent3: { name: "OFAC Screening", progress: 100, status: latestResult.verification_status === 'VALID' ? "completed" : (latestResult.message?.includes('OFAC') ? "invalid" : "idle"), message: latestResult.message },
            kycComplete: { name: "KYC Complete", progress: latestResult.kyc_completed ? 100 : 50, status: latestResult.kyc_completed ? "completed" : "incomplete" }
          });
          setValidationResults(latestResult);
          setActiveTab("status");
        }
      }
    };

    pollingRef.current = setInterval(poll, 1500);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingDocIds]);

  const normalizeStatus = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'Completed';
      case 'processing': return 'Processing';
      case 'idle': return 'Idle';
      default: return 'Idle';
    }
  };

  const handleLogin = () => {
    setAuthError('');
    if (name.trim() === VALID_USERNAME && password.trim() === VALID_PASSWORD) {
      setAuthenticated(true);
    } else {
      setAuthError('Invalid username or password. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  const handleUpload = async () => {
    const filesToUpload = [];
    if (passportFile) filesToUpload.push({ key: 'passport', label: 'Passport', file: passportFile });
    if (licenseFile) filesToUpload.push({ key: 'license', label: 'Driving License', file: licenseFile });
    if (idCardFile) filesToUpload.push({ key: 'idCard', label: 'ID Card', file: idCardFile });

    if (filesToUpload.length === 0) {
      alert('Please upload at least one document');
      return;
    }

    setUploading(true);
    setShowConsole(true);
    setAgentLogs([{ text: `[System] KYC Pipeline initialized \u2014 ${filesToUpload.length} document(s) queued`, time: new Date().toLocaleTimeString() }]);
    setAgentProgress({
      agent1: { name: "Document Processing", progress: 0, status: "processing" },
      agent2: { name: "Validation", progress: 0, status: "idle" },
      agent3: { name: "OFAC Screening", progress: 0, status: "idle" },
      kycComplete: { name: "KYC Complete", progress: 0, status: "idle" }
    });

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
        setAgentLogs(prev => [...prev, { text: `[Error] \u2717 Network error uploading ${label}: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
      }
    }

    if (Object.keys(newDocIds).length > 0) {
      setPollingDocIds(newDocIds);
    } else {
      setUploading(false);
    }
  };

  const handleDemoUpload = async () => {
    // Populate the UI previews
    setPreviewUrls({
      passport: '/demo-passport.png',
      license: '/demo-dl.png',
      idCard: '/demo-id.png'
    });
    
    setUploading(true);
    setShowConsole(true);
    setAgentLogs([{ text: '[System] Demo mode — Loading sample documents...', time: new Date().toLocaleTimeString() }]);
    setActiveTab("upload");
    
    setAgentProgress({
      agent1: { name: "Document Processing", progress: 0, status: "processing" },
      agent2: { name: "Validation", progress: 0, status: "idle" },
      agent3: { name: "OFAC Screening", progress: 0, status: "idle" },
      kycComplete: { name: "KYC Complete", progress: 0, status: "idle" }
    });

    const newDocIds = {};
    const docTypes = ['license']; // We can add 'passport' and 'idCard' here to process all three
    
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

  // === CUSTOMER VERIFICATION ===
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [customerDetails, setCustomerDetails] = useState(null);
  const [verificationError, setVerificationError] = useState('');
  const [isCustomerVerified, setIsCustomerVerified] = useState(false);

  const mockCustomerData = {
    "CUST001": { name: "John Doe", email: "john.doe@email.com", phone: "+1-555-0123", status: "Active" },
    "CUST002": { name: "Jane Smith", email: "jane.smith@email.com", phone: "+1-555-0456", status: "Pending" },
    "CUST003": { name: "Mike Johnson", email: "mike.johnson@email.com", phone: "+1-555-0789", status: "Active" }
  };

  const handleCustomerVerification = () => {
    const customerId = customerIdInput.trim().toUpperCase();
    if (mockCustomerData[customerId]) {
      setCustomerDetails(mockCustomerData[customerId]);
      setIsCustomerVerified(true);
      setVerificationError('');
    } else {
      setVerificationError("Customer not found. Try CUST001, CUST002, or CUST003");
      setCustomerDetails(null);
      setIsCustomerVerified(false);
    }
  };

  // === RENDER: LOGIN ===
  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 flex flex-col">
      <header className="p-5">
        <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-16 w-auto" />
      </header>

      <div className="flex-grow flex items-center justify-center px-4">
        <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl p-10 w-full max-w-xl border border-white/50 transform transition-all duration-500 hover:shadow-3xl">
          <h2 className="text-3xl font-bold text-center text-[#001f3f] mb-2">
            Welcome to KYC Portal
          </h2>
          <p className="text-sm text-center text-gray-500 mb-8">
            Please enter your credentials to continue
          </p>

          <input
            type="text"
            placeholder="Agent Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 mb-4 border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 mb-6 border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all text-sm"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-[#F15840] to-[#ff7b5e] hover:from-[#d44a35] hover:to-[#e5684e] text-white font-semibold px-4 py-3 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
          >
            Login
          </button>

          {authError && (
            <p className="mt-4 text-red-500 text-sm text-center animate-pulse">{authError}</p>
          )}

          <div className="mt-8 text-center border-t pt-6 border-gray-200">
            <p className="text-xs text-gray-400 mb-2">Are you a recruiter evaluating this project?</p>
            <button
              onClick={() => setAuthenticated(true)}
              className="inline-flex items-center space-x-2 text-sm font-bold text-[#F15840] hover:text-[#d44a35] transition duration-300 group"
            >
              <Play className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              <span className="underline underline-offset-4">CLICK HERE FOR RECRUITER VIEW</span>
            </button>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 py-4">
        © 2025 Coforge. All rights reserved.
      </footer>
    </div>
  );

  // === RENDER: HOME / DASHBOARD ===
  const renderHome = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#001f3f] to-[#003366] rounded-2xl p-8 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Welcome to KYC Portal</h2>
        <p className="text-blue-200 text-sm">Get Started with your KYC verification process.</p>
      </div>

      {/* Customer Verification */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-semibold mb-1 text-gray-800">Customer Verification</h2>
        <p className="text-sm text-gray-500 mb-4">Enter Customer ID to verify and retrieve customer information.</p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-800">
            <strong>Demo Customer IDs:</strong> CUST001, CUST002, CUST003
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={customerIdInput}
            onChange={(e) => setCustomerIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomerVerification()}
            placeholder="Enter Customer ID (e.g., CUST001)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleCustomerVerification}
            className="bg-gradient-to-r from-[#F15840] to-[#ff7b5e] text-white px-5 py-2.5 rounded-xl hover:shadow-lg transition-all text-sm font-medium"
          >
            Verify Customer
          </button>
        </div>

        {verificationError && <p className="text-red-500 mt-3 text-sm">{verificationError}</p>}

        {customerDetails && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="font-semibold text-emerald-800 flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Customer Verified Successfully!</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-700">
              <p><strong>Name:</strong> {customerDetails.name}</p>
              <p><strong>Email:</strong> {customerDetails.email}</p>
              <p><strong>Phone:</strong> {customerDetails.phone}</p>
              <p><strong>Status:</strong> <span className={customerDetails.status === 'Active' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>{customerDetails.status}</span></p>
            </div>
          </div>
        )}
      </div>

      {isCustomerVerified ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard icon={Upload} title="Upload Documents" description="Start your verification process" color="border-blue-500" onClick={() => setActiveTab("upload")} />
          <ActionCard icon={Activity} title="Check Status" description="View KYC processing status" color="border-green-500" onClick={() => setActiveTab("status")} />
          <ActionCard icon={Bell} title="Alerts" description="Check compliance issues" color="border-yellow-500" onClick={() => setActiveTab("alerts")} />
        </div>
      ) : (
        <p className="text-gray-400 italic text-sm">Please verify a customer to proceed.</p>
      )}
    </div>
  );

  // === RENDER: UPLOAD ===
  const renderUpload = () => {
    const documents = [
      { key: 'passport', label: 'Passport', description: 'National passport document', file: passportFile, setter: setPassportFile, gradient: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50', borderActive: 'border-blue-400', iconEmoji: '\uD83D\uDEC2' },
      { key: 'license', label: 'Driving License', description: 'Valid driving license', file: licenseFile, setter: setLicenseFile, gradient: 'from-emerald-500 to-teal-600', bgLight: 'bg-emerald-50', borderActive: 'border-emerald-400', iconEmoji: '\uD83D\uDE97' },
      { key: 'idCard', label: 'ID Card', description: 'Government-issued ID card', file: idCardFile, setter: setIdCardFile, gradient: 'from-purple-500 to-violet-600', bgLight: 'bg-purple-50', borderActive: 'border-purple-400', iconEmoji: '\uD83E\uDEAA' },
    ];
    const selectedCount = [passportFile, licenseFile, idCardFile].filter(Boolean).length;

    return (
      <div className="space-y-6">
        {/* Demo Section for Recruiters */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Try Demo</h3>
              <p className="text-xs text-gray-500">No documents? Use our pre-loaded sample to see the full AI pipeline in action.</p>
            </div>
          </div>
          <button
            onClick={handleDemoUpload}
            disabled={uploading}
            className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2
              ${uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5'}`}
          >
            <Terminal className="w-4 h-4" />
            <span>{uploading ? 'Processing Demo...' : 'Run Demo with Sample Document'}</span>
          </button>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Upload Documents</h3>
              <p className="text-sm text-gray-500">Upload your documents for KYC verification. Preview is shown after selection.</p>
            </div>
            {selectedCount > 0 && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
                {selectedCount}/3 selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {documents.map(doc => (
              <div key={doc.key}
                className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                  (doc.file || previewUrls[doc.key])
                    ? doc.borderActive + ' shadow-lg hover:shadow-xl'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${doc.gradient} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{doc.iconEmoji}</span>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{doc.label}</h4>
                      <p className="text-white/70 text-[10px]">{doc.description}</p>
                    </div>
                  </div>
                  {(doc.file || previewUrls[doc.key]) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">READY</span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 bg-white">
                  {(doc.file || previewUrls[doc.key]) ? (
                    <div className="relative group">
                      {/* Preview Area */}
                      {previewUrls[doc.key] ? (
                        <div className="relative overflow-hidden rounded-xl border border-gray-100">
                          <img
                            src={previewUrls[doc.key]}
                            alt={`${doc.label} preview`}
                            className="w-full h-44 object-contain bg-gray-50"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 rounded-xl"></div>
                        </div>
                      ) : (
                        <div className={`w-full h-44 ${doc.bgLight} rounded-xl flex flex-col items-center justify-center border border-dashed ${doc.borderActive}`}>
                          <span className="text-4xl mb-2">\uD83D\uDCC4</span>
                          <p className="text-xs font-medium text-gray-600">PDF Document</p>
                        </div>
                      )}

                      {/* File Info Bar */}
                      <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-700 truncate">{doc.file ? doc.file.name : `Demo ${doc.label}`}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{doc.file ? formatFileSize(doc.file.size) : 'Sample Demo File'}</p>
                        </div>
                        <button
                          onClick={() => handleFileRemove(doc.key, doc.setter)}
                          className="shrink-0 p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all duration-200"
                          title="Remove file"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <div className={`w-full h-44 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-gray-400 hover:${doc.bgLight} transition-all duration-200 group`}>
                        <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center mb-3 transition-colors">
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-gray-500 transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">Click to upload</p>
                        <p className="text-[10px] text-gray-300 mt-1">PDF, PNG, JPG \u2022 Max 10MB</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileSelect(doc.key, doc.setter, e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || selectedCount === 0}
            className={`mt-6 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center space-x-2
              ${uploading || selectedCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#001f3f] to-[#003a6b] hover:from-[#002a54] hover:to-[#004a8b] text-white shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30 hover:-translate-y-0.5'}`}
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Processing...' : `Upload & Verify ${selectedCount > 0 ? `(${selectedCount} Document${selectedCount > 1 ? 's' : ''})` : 'All Documents'}`}</span>
          </button>
        </div>
      </div>
    );
  };

  // === RENDER: STATUS ===
  const renderStatus = () => {
    if (!agentProgress) return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
          <Upload className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700">No Documents Uploaded</h2>
        <p className="mt-2 text-sm text-gray-400">Start your KYC process by uploading documents.</p>
        <button
          onClick={() => setActiveTab("upload")}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#F15840] to-[#ff7b5e] text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
        >
          Upload Now
        </button>
      </div>
    );

    const allValid = Object.values(agentProgress).every(
      (step) => step.status === 'completed' || step.status === 'valid'
    );

    const extendedProgress = {
      ...agentProgress,
      ...(allValid && {
        kycComplete: { name: 'KYC Complete', progress: 100, status: 'completed' }
      })
    };

    const getStatusIcon = (status) => {
      if (status === 'completed') return <CheckCircle className="text-emerald-500 w-5 h-5" />;
      if (status === 'invalid') return <XCircle className="text-red-500 w-5 h-5" />;
      return <Clock className="text-yellow-500 w-5 h-5" />;
    };

    return (
      <div className="space-y-3">
        {Object.entries(extendedProgress).map(([key, val]) => (
          <div
            key={key}
            className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-gray-100 transform transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center space-x-3">
              {getStatusIcon(val.status)}
              <div>
                <div className="font-semibold text-gray-800">{val.name}</div>
                <div className="text-sm text-gray-500">
                  {normalizeStatus(val.status)}
                  {val.message && (
                    <div className="text-xs text-red-500 mt-1">{val.message}</div>
                  )}
                </div>
              </div>
            </div>
            <button className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
              <Eye className="w-4 h-4 mr-1" /> View
            </button>
          </div>
        ))}
      </div>
    );
  };

  // === RENDER: ALERTS ===
  const renderAlerts = () => (
    <div>
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700">No Alerts Yet</h2>
            <p className="mt-2 text-sm text-gray-400">You haven't received any alerts. Upload documents to get started.</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#F15840] to-[#ff7b5e] text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
            >
              Upload Now
            </button>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl mb-3 border-l-4 ${
                alert.type === 'pep' ? 'bg-yellow-50 border-yellow-500' :
                alert.type === 'sanctioned_country' ? 'bg-red-50 border-red-500' :
                'bg-orange-50 border-orange-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <AlertCircle className={`${
                  alert.type === 'pep' ? 'text-yellow-500' :
                  alert.type === 'sanctioned_country' ? 'text-red-500' :
                  'text-orange-500'
                }`} size={20} />
                <p className="font-medium text-gray-800 text-sm">{alert.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // === RENDER CONTENT SWITCH ===
  const renderContent = () => {
    switch (activeTab) {
      case "upload": return renderUpload();
      case "status": return renderStatus();
      case "alerts": return renderAlerts();
      default: return renderHome();
    }
  };

  // === MAIN RETURN ===
  return (
    <div className="min-h-screen bg-[#f4f7fa] font-sans">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>

      {!authenticated ? renderLogin() : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
            <img src={CoforgeLogoImage} alt="Coforge Logo" className="h-12 w-auto" />
            <div className="flex items-center space-x-3">
              {showConsole ? (
                <button
                  onClick={() => setShowConsole(false)}
                  className="flex items-center space-x-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Terminal className="w-3.5 h-3.5" /> <span>Hide Console</span>
                </button>
              ) : agentLogs.length > 0 && (
                <button
                  onClick={() => setShowConsole(true)}
                  className="flex items-center space-x-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Terminal className="w-3.5 h-3.5" /> <span>Show Console</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex" style={{ minHeight: 'calc(100vh - 105px)' }}>
            {/* Sidebar */}
            <div className="w-60 bg-gradient-to-b from-[#001f3f] to-[#003a6b] p-5 text-white flex flex-col">
              <nav className="space-y-2 flex-1">
                <TabButton id="home" icon={Home} label="Dashboard" active={activeTab === "home"} onClick={setActiveTab} />
                <TabButton id="upload" icon={Upload} label="Upload" active={activeTab === "upload"} onClick={setActiveTab} />
                <TabButton id="status" icon={Activity} label="Status" active={activeTab === "status"} onClick={setActiveTab} />
                <TabButton id="alerts" icon={Bell} label="Alerts" active={activeTab === "alerts"} onClick={setActiveTab} />
              </nav>

              {/* Sidebar demo quick action */}
              <div className="mt-auto pt-4 border-t border-white/10">
                <button
                  onClick={handleDemoUpload}
                  disabled={uploading}
                  className="w-full flex items-center justify-center space-x-2 text-xs font-medium py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Demo</span>
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto animate-fadeIn">
              {renderContent()}
            </div>

            {/* Agent Console Side Panel */}
            <AgentConsole
              logs={agentLogs}
              visible={showConsole}
              onClose={() => setShowConsole(false)}
            />
          </div>

          {/* Footer */}
          <footer className="bg-[#001f3f] text-white/60 text-center py-3 text-xs">
            © 2025 Coforge. All rights reserved. | Powered by Azure + Gemini AI
          </footer>
        </>
      )}
    </div>
  );
};

export default KYCPortal;