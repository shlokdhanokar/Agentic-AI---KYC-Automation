import React, { useState, useEffect } from 'react';
import {
  Upload, FileText, AlertCircle, CheckCircle, XCircle, Eye, Clock,
  Home, Activity, Bell, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';

type TabButtonProps = {
  id: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: (id: string) => void;
};

const TabButton = ({ id, icon: Icon, label, active, onClick }: TabButtonProps) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all w-full text-left font-medium text-sm tracking-wide
    ${active ? 'bg-[#F15840] text-white shadow-lg' : 'text-[#c0d3e0] hover:bg-[#003f6b] hover:text-white'}`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

type ActionCardProps = {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
  badge: number;
};

const ActionCard = ({ icon: Icon, title, description, color, onClick, badge }: ActionCardProps) => (
  <motion.div
    onClick={onClick}
    whileHover={{ scale: 1.03 }}
    className={`p-4 rounded-lg shadow-md cursor-pointer bg-white border-l-4 ${color}`}
  >
    {badge > 0 && <div className="text-sm text-red-500">{badge}</div>}
    <h4 className="text-lg font-semibold">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </motion.div>
);
type ProgressBarProps = {
  label: string;
  progress: number;
  status: 'Completed' | 'Processing' | 'Idle';
};

const ProgressBar = ({ label, progress, status }: ProgressBarProps) => (
  <motion.div
    className="mb-4 p-4 bg-white rounded-lg shadow flex justify-between items-center"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div>
      <h4 className="font-semibold text-gray-800 text-sm">{label}</h4>
    </div>
    <div className="flex items-center space-x-2">
      <div className="relative w-36 h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-2 bg-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span>{label}</span>
      {status === 'Completed' && <CheckCircle className="text-green-500" />}
      {status === 'Processing' && <Clock className="text-yellow-500" />}
      {status === 'Idle' && <AlertCircle className="text-gray-400" />}
    </div>
  </motion.div>
);

const KYCPortal = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [footerNote] = useState("© 2025 Coforge");
  type Alert = {
    id: number;
    message: string;
    type: 'pep' | 'sanctioned_country' | 'linked_person';
  };

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [agentProgress, setAgentProgress] = useState<any>(null);

  const normalizeStatus = (status: string): 'Completed' | 'Processing' | 'Idle' => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'Completed';
    case 'processing':
      return 'Processing';
    case 'idle':
      return 'Idle';
    default:
      return 'Idle';
  }
};

  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    const formData = new FormData();
    if (passportFile) formData.append("documents", passportFile);
    if (licenseFile) formData.append("documents", licenseFile);
    if (idCardFile) formData.append("documents", idCardFile);

    setUploading(true);
    try {
      const response = await fetch("http://localhost:5000/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      setValidationResults(result.results);

      const backendProgress = result.progress || {};
      setAgentProgress({
        agent1: {
          name: "Document Processing",
          progress: backendProgress["Document Processing"] === "completed" ? 100 : 0,
          status: backendProgress["Document Processing"] || "idle",
        },
        agent2: {
          name: "Validation",
          progress: backendProgress["Validation"] === "completed" ? 100 : 60,
          status: backendProgress["Validation"] || "idle",
        },

        ...(backendProgress["KYC Complete"] && {
          kycComplete: {
            name: "KYC Complete",
            progress: backendProgress["KYC Complete"] === "completed" ? 100 : 0,
            status: backendProgress["KYC Complete"],
          },
        }),
      });

      setActiveTab("status");
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };


  const handleLogin = async () => {
    const response = await fetch('http://localhost:5000/api/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id }),
    });
    
    const result = await response.json();
    if (response.ok) {
      setAuthenticated(true);
    } else {
      setAuthError(result.message);
    }
  };

  
  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col">
      {/* Header with Logo */}
      <header className="p-4">
        <img
          src="coforge_logo.png" // Make sure this file is in your public folder
          alt="Company Logo"
          className="h-16"
        />
      </header>

      {/* Centered Login Box */}
      <div className="flex-grow flex items-center justify-center">
        <motion.div
          className="bg-white shadow-xl rounded-lg p-10 w-full max-w-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-center text-blue-900 mb-4">
            Welcome to KYC Portal
          </h2>
          <p className="text-md text-center text-black-800 mb-6">
            Please enter your credentials to continue
          </p>

          <input
            type="text"
            placeholder="Agent Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Password"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-orange-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded transition duration-300"
          >
            Login
          </button>

          {authError && (
            <p className="mt-4 text-red-500 text-sm text-center animate-pulse">
              {authError}
            </p>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-blue-800 py-4">
        © 2025 Coforge. All rights reserved.
      </footer>
    </div>
  );

  const [customerIdInput, setCustomerIdInput] = useState('');
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [verificationError, setVerificationError] = useState('');
  const [isCustomerVerified, setIsCustomerVerified] = useState(false);


  const handleCustomerVerification = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/verify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customerIdInput.trim() }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCustomerDetails(result.customer);
        setIsCustomerVerified(true);
        setVerificationError('');
      } else {
        setVerificationError(result.message || "Verification failed");
        setCustomerDetails(null);
        setIsCustomerVerified(false);
      }
    } catch (error) {
      setVerificationError("Server error. Please try again.");
      setCustomerDetails(null);
      setIsCustomerVerified(false);
    }
  };


  const renderHome = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] rounded-lg p-6 text-white shadow">
        <h2 className="text-2xl font-bold mb-2">Welcome to KYC Portal</h2>
        <p className="text-blue-100">Get Started with your KYC.</p>
      </div>

      <div className="flex-grow flex items-center justify-center"></div>
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Customer Verification</h2>
        <p className="text-sm text-gray-600 mb-4">Enter Customer ID to verify and retrieve customer information.</p>
        <input
          type="text"
          value={customerIdInput}
          onChange={(e) => setCustomerIdInput(e.target.value)}
          placeholder="Enter Customer ID"
          className="border border-gray-300 rounded px-4 py-2 mr-2"
        />
        <button
          onClick={handleCustomerVerification}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Verify Customer
        </button>

        {verificationError && (
          <p className="text-red-500 mt-2">{verificationError}</p>
        )}

        {customerDetails && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
            <p className="font-semibold text-green-800">Customer Verified Successfully!</p>     
            <p><strong>Customer Name:</strong> {customerDetails.name}</p>
            <p><strong>Email:</strong> {customerDetails.email}</p>
            <p><strong>Phone Number:</strong> {customerDetails.phone}</p>
            <p><strong>Status:</strong> {customerDetails.status}</p>

          </div>
        )}
      </div>

      {isCustomerVerified ? (
        <>
          {/* Render tabs and action cards here */
          <div className="bg-[#d6eaf8] p-6 rounded-lg space-y-4">
            <ActionCard icon={Upload} title="Upload Documents" description="Start your verification process" color="text-blue-600" onClick={() => setActiveTab("upload")} badge={0} />
            <ActionCard icon={Activity} title="Status" description="Check KYC Status" color="text-green-600" onClick={() => setActiveTab("status")} badge={0} />
            <ActionCard icon={Bell} title="Alerts" description="Check compliance issues" color="text-yellow-500" onClick={() => setActiveTab("alerts")} badge={alerts.length} />
          </div>
          }
        </>
      ) : (
        <p className="text-gray-500 italic">Please verify customer to proceed.</p>
      )}
    </motion.div>
  );

  const renderUpload = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Upload Documents</h3>

        {/* Passport Upload */}
        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Passport (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg"
            onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {passportFile && <p className="mt-2 text-sm text-green-600">Selected: {passportFile.name}</p>}
        </label>

        {/* Driving License Upload */}
        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Driving License (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg"
            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {licenseFile && <p className="mt-2 text-sm text-green-600">Selected: {licenseFile.name}</p>}
        </label>

        {/* ID Card Upload */}
        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Identification Card (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg"
            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {idCardFile && <p className="mt-2 text-sm text-green-600">Selected: {idCardFile.name}</p>}
        </label>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-4 w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 transition"
        >
          {uploading ? "Uploading..." : "Upload All Documents"}
        </button>
      </div>
    </motion.div>
  );

  type AgentProgress = {
  [key: string]: {
    name: string;
    progress: number;
    status: string;
  };
};

const [modalData, setModalData] = useState(null);
const [showModal, setShowModal] = useState(false)

const renderStatus = () => {
  if (!agentProgress) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-blue-500">
      <svg className="w-20 h-20 mb-4 animate-bounce" fill="none" stroke="orange" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <h2 className="text-xl font-semibold">No Documents Uploaded</h2>
      <p className="mt-2 text-sm text-black-400">Start your KYC process by uploading your documents.</p>
      <button
        onClick={() => setActiveTab("upload")}
        className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-blue-700 transition"
      >
        Upload Now
      </button>
    </div>
  );

    
    const allValid = Object.values(agentProgress as AgentProgress).every(
      (step) => step.status === 'completed' || step.status === 'valid'
    );


    const extendedProgress: AgentProgress = {
      ...agentProgress,
      ...(allValid && {
        kycComplete: {
          name: 'KYC Complete',
          progress: 100,
          status: 'completed',
        },
      }),
    };


    const handleViewClick = (stepKey: string) => {
      const stepData = validationResults?.[stepKey];
      setModalData(stepData); // You can use a modal or expandable section
      setShowModal(true);
    };

    const getStatusIcon = (status: string) => {
      if (status === 'completed') return <CheckCircle className="text-green-500" />;
      if (status === 'invalid') return <XCircle className="text-red-500" />;
      return <Clock className="text-yellow-500" />;
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        {Object.entries(extendedProgress).map(([key, val]) => (
          <motion.div
            key={key}
            className="flex justify-between items-center p-4 bg-white rounded shadow"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center space-x-3">
              {getStatusIcon(val.status)}
              <div>
                <div className="font-semibold">{val.name}</div>
                <div className="text-sm text-gray-500">{normalizeStatus(val.status)}</div>
              </div>
            </div>
            <button
              onClick={() => handleViewClick(key)}
              className="flex items-center text-blue-600 hover:underline"
            >
              <Eye className="w-4 h-4 mr-1" /> View
            </button>
          </motion.div>
        ))}
      </motion.div>
    );
  };


  const renderAlerts = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col items-center justify-center h-full text-center text-blue-500">
        <svg
          className="w-20 h-20 mb-4 animate-bounce"
          fill="none"
          stroke="red"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8z" />
        </svg>
        <h2 className="text-xl font-semibold">No Alerts Yet</h2>
        <p className="mt-2 text-sm text-gray-400">
          You haven't received any alerts. Upload your documents to get started.
        </p>
        <button
          onClick={() => setActiveTab('upload')}
          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-blue-700 transition"
        >
          Upload Now
        </button>
      </div>

        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg mb-4 border-l-4 ${
              alert.type === 'pep'
                ? 'bg-yellow-50 border-yellow-500'
                : alert.type === 'sanctioned_country'
                ? 'bg-red-50 border-red-500'
                : 'bg-orange-50 border-orange-500'
            }`}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle
                className={`${
                  alert.type === 'pep'
                    ? 'text-yellow-500'
                    : alert.type === 'sanctioned_country'
                    ? 'text-red-500'
                    : 'text-orange-500'
                }`}
                size={20}
              />
              <div>
                <p className="font-medium text-gray-800">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "upload": return renderUpload();
      case "status": return renderStatus();
      case "alerts": return renderAlerts();
      default: return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] font-sans">
      {!authenticated ? renderLogin() : (
        <>
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#f0f3f4] to-[#5F8AC7] shadow-md">
            <img src="/coforge_logo.png" className="h-16 w-auto" />
          </div>

          <div className="flex">
            <div className="w-64 min-h-screen bg-gradient-to-b from-[#001f3f] to-[#5dade2] p-6 text-white">
              <nav className="space-y-2">
                <TabButton id="home" icon={Home} label="Dashboard" active={activeTab === "home"} onClick={setActiveTab} />
                <TabButton id="upload" icon={Upload} label="Upload" active={activeTab === "upload"} onClick={setActiveTab} />
                <TabButton id="status" icon={Activity} label="Status" active={activeTab === "status"} onClick={setActiveTab} />
                <TabButton id="alerts" icon={Bell} label="Alerts" active={activeTab === "alerts"} onClick={setActiveTab} />
              </nav>
            </div>

            <div className="flex-1 p-6">
              {renderContent()}
            </div>
          </div>

          <footer className="bg-[#003f6b] text-white text-center py-3 text-sm">
            {footerNote}
          </footer>
        </>
      )}
    </div>
  );
};

export default KYCPortal;
