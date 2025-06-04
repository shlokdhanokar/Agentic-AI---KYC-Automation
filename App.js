import React, { useState, useEffect } from 'react';
import {
  Upload, FileText, AlertCircle, CheckCircle, XCircle, Eye, Clock,
  Home, Activity, Bell, Shield
} from 'lucide-react';
import CoforgeLogoImage from './Coforge-logo-Coral-Blue.png';

const TabButton = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all w-full text-left font-medium text-sm tracking-wide
    ${active ? 'bg-[#F15840] text-white shadow-lg' : 'text-[#c0d3e0] hover:bg-[#003f6b] hover:text-white'}`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

const ActionCard = ({ icon: Icon, title, description, color, onClick, badge }) => (
  <div
    onClick={onClick}
    className={`p-4 rounded-lg shadow-md cursor-pointer bg-white border-l-4 ${color} transform transition-all duration-200 hover:scale-105 hover:shadow-lg`}
  >
    {badge > 0 && <div className="text-sm text-red-500">{badge}</div>}
    <h4 className="text-lg font-semibold">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);

const ProgressBar = ({ label, progress, status }) => (
  <div className="mb-4 p-4 bg-white rounded-lg shadow flex justify-between items-center animate-fadeIn">
    <div>
      <h4 className="font-semibold text-gray-800 text-sm">{label}</h4>
    </div>
    <div className="flex items-center space-x-2">
      <div className="relative w-36 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-2 bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span>{label}</span>
      {status === 'Completed' && <CheckCircle className="text-green-500" />}
      {status === 'Processing' && <Clock className="text-yellow-500" />}
      {status === 'Idle' && <AlertCircle className="text-gray-400" />}
    </div>
  </div>
);

const KYCPortal = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [footerNote] = useState("© 2025 Coforge");
  const [alerts, setAlerts] = useState([]);
  const [agentProgress, setAgentProgress] = useState(null);

  const normalizeStatus = (status) => {
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
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [file, setFile] = useState(null);
  const [passportFile, setPassportFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    passport: 0,
    license: 0,
    idCard: 0
  });

  const VALID_USERNAME = "shlok";
  const VALID_PASSWORD = "12345";

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
  if (!passportFile && !licenseFile && !idCardFile) {
    alert('Please upload at least one document');
    return;
  }

  setUploading(true);
  setAgentProgress({
    agent1: {
      name: "Document Processing",
      progress: 0,
      status: "processing",
    },
    agent2: {
      name: "Validation",
      progress: 0,
      status: "idle",
    },
    kycComplete: {
      name: "KYC Complete",
      progress: 0,
      status: "idle",
    },
  });

  try {
    const formData = new FormData();
    if (passportFile) formData.append('passport', passportFile);
    if (licenseFile) formData.append('license', licenseFile);
    if (idCardFile) formData.append('id_card', idCardFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:5000/upload', true);

    // Track upload progress
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(prev => ({
          ...prev,
          passport: progress,
          license: progress,
          idCard: progress
        }));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        console.log('Upload successful:', response);

        // Determine validation status
        let validationStatus = "completed";
        let validationMessage = "All documents are valid";
        let kycStatus = "completed";
        
        // Check each document status
        const invalidDocuments = [];
        const validationMessages = [];
        
        if (response.passport && response.passport.status === "INVALID") {
          invalidDocuments.push("Passport");
          validationMessages.push(response.passport.message);
        }
        if (response.license && response.license.status === "INVALID") {
          invalidDocuments.push("Driving License");
          validationMessages.push(response.license.message);
        }
        if (response.id_card && response.id_card.status === "INVALID") {
          invalidDocuments.push("ID Card");
          validationMessages.push(response.id_card.message);
        }

        if (invalidDocuments.length > 0) {
          validationStatus = "invalid";
          validationMessage = `Invalid documents: ${invalidDocuments.join(", ")}\n${validationMessages.join("\n")}`;
          kycStatus = "incomplete";
        }

        // Update progress based on backend response
        setAgentProgress({
          agent1: {
            name: "Document Processing",
            progress: 100,
            status: "completed",
          },
          agent2: {
            name: "Validation",
            progress: 100,
            status: validationStatus,
            message: validationMessage
          },
          kycComplete: {
            name: "KYC Complete",
            progress: kycStatus === "completed" ? 100 : 50,
            status: kycStatus,
          },
        });

        setValidationResults(response);
        setActiveTab("status");
      } else {
        console.error('Upload failed:', xhr.responseText);
        setAgentProgress({
          agent1: {
            name: "Document Processing",
            progress: 0,
            status: "invalid",
          },
          agent2: {
            name: "Validation",
            progress: 0,
            status: "idle",
          },
          kycComplete: {
            name: "KYC Complete",
            progress: 0,
            status: "idle",
          },
        });
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      console.error('Upload error');
      setUploading(false);
      setAgentProgress({
        agent1: {
          name: "Document Processing",
          progress: 0,
          status: "invalid",
        },
        agent2: {
          name: "Validation",
          progress: 0,
          status: "idle",
        },
        kycComplete: {
          name: "KYC Complete",
          progress: 0,
          status: "idle",
        },
      });
    };

    xhr.send(formData);
  } catch (error) {
    console.error("Upload failed:", error);
    setUploading(false);
    setAgentProgress({
      agent1: {
        name: "Document Processing",
        progress: 0,
        status: "invalid",
      },
      agent2: {
        name: "Validation",
        progress: 0,
        status: "idle",
      },
      kycComplete: {
        name: "KYC Complete",
        progress: 0,
        status: "idle",
      },
    });
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

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col">
      <header className="p-4">
        <div className="h-16 flex items-center">
          <img 
            src={CoforgeLogoImage} 
            alt="Coforge Logo" 
            className="h-20 w-auto"
          />
        </div>
      </header>

      <div className="flex-grow flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-lg p-10 w-full max-w-xl transform transition-all duration-500 hover:shadow-2xl animate-fadeIn">
          <h2 className="text-4xl font-bold text-center text-blue-900 mb-4">
            Welcome to KYC Portal
          </h2>
          <p className="text-md text-center text-black-800 mb-6">
            Please enter your credentials to continue
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Login Credentials:</strong><br/>
              Username: shlok<br/>
              Password: 12345
            </p>
          </div>

          <input
            type="text"
            placeholder="Agent Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        </div>
      </div>

      <footer className="text-center text-xs text-blue-800 py-4">
        © 2025 Coforge. All rights reserved.
      </footer>
    </div>
  );

  const [customerIdInput, setCustomerIdInput] = useState('');
  const [customerDetails, setCustomerDetails] = useState(null);
  const [verificationError, setVerificationError] = useState('');
  const [isCustomerVerified, setIsCustomerVerified] = useState(false);

  const mockCustomerData = {
    "CUST001": {
      name: "John Doe",
      email: "john.doe@email.com",
      phone: "+1-555-0123",
      status: "Active"
    },
    "CUST002": {
      name: "Jane Smith",
      email: "jane.smith@email.com",
      phone: "+1-555-0456",
      status: "Pending"
    },
    "CUST003": {
      name: "Mike Johnson",
      email: "mike.johnson@email.com",
      phone: "+1-555-0789",
      status: "Active"
    }
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

  const renderHome = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] rounded-lg p-6 text-white shadow">
        <h2 className="text-2xl font-bold mb-2">Welcome to KYC Portal</h2>
        <p className="text-blue-100">Get Started with your KYC.</p>
      </div>

      <div className="flex-grow flex items-center justify-center"></div>
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Customer Verification</h2>
        <p className="text-sm text-gray-600 mb-4">Enter Customer ID to verify and retrieve customer information.</p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-700">
            <strong>Demo Customer IDs:</strong> CUST001, CUST002, CUST003
          </p>
        </div>
        
        <input
          type="text"
          value={customerIdInput}
          onChange={(e) => setCustomerIdInput(e.target.value)}
          placeholder="Enter Customer ID (e.g., CUST001)"
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
          <div className="bg-[#d6eaf8] p-6 rounded-lg space-y-4">
            <ActionCard icon={Upload} title="Upload Documents" description="Start your verification process" color="text-blue-600" onClick={() => setActiveTab("upload")} badge={0} />
            <ActionCard icon={Activity} title="Status" description="Check KYC Status" color="text-green-600" onClick={() => setActiveTab("status")} badge={0} />
            <ActionCard icon={Bell} title="Alerts" description="Check compliance issues" color="text-yellow-500" onClick={() => setActiveTab("alerts")} badge={alerts.length} />
          </div>
        </>
      ) : (
        <p className="text-gray-500 italic">Please verify customer to proceed.</p>
      )}
    </div>
  );

  const renderUpload = () => (
    <div className="animate-fadeIn">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Upload Documents</h3>

        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Passport (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {passportFile && (
            <div className="mt-2">
              <p className="text-sm text-green-600">Selected: {passportFile.name}</p>
              {uploadProgress.passport > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress.passport}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </label>

        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Driving License (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {licenseFile && (
            <div className="mt-2">
              <p className="text-sm text-green-600">Selected: {licenseFile.name}</p>
              {uploadProgress.license > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress.license}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </label>

        <label className="block border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-blue-400 mb-4">
          <Upload size={30} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Upload Identification Card (PDF, PNG, JPG)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {idCardFile && (
            <div className="mt-2">
              <p className="text-sm text-green-600">Selected: {idCardFile.name}</p>
              {uploadProgress.idCard > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress.idCard}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </label>

        <button
          onClick={handleUpload}
          disabled={uploading || (!passportFile && !licenseFile && !idCardFile)}
          className={`mt-4 w-full py-2 rounded transition
            ${uploading || (!passportFile && !licenseFile && !idCardFile) 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-700 hover:bg-blue-800 text-white'}`}
        >
          {uploading ? "Uploading..." : "Upload All Documents"}
        </button>
      </div>
    </div>
  );

  const [modalData, setModalData] = useState(null);
  const [showModal, setShowModal] = useState(false);

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

  const allValid = Object.values(agentProgress).every(
    (step) => step.status === 'completed' || step.status === 'valid'
  );

  const extendedProgress = {
    ...agentProgress,
    ...(allValid && {
      kycComplete: {
        name: 'KYC Complete',
        progress: 100,
        status: 'completed',
      },
    }),
  };

  const handleViewClick = (stepKey) => {
    const stepData = validationResults?.[stepKey];
    setModalData(stepData);
    setShowModal(true);
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="text-green-500" />;
    if (status === 'invalid') return <XCircle className="text-red-500" />;
    return <Clock className="text-yellow-500" />;
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {Object.entries(extendedProgress).map(([key, val]) => (
        <div
          key={key}
          className="flex justify-between items-center p-4 bg-white rounded shadow transform transition-all duration-200 hover:scale-105 hover:shadow-md"
        >
          <div className="flex items-center space-x-3">
            {getStatusIcon(val.status)}
            <div>
              <div className="font-semibold">{val.name}</div>
              <div className="text-sm text-gray-500">
                {normalizeStatus(val.status)}
                {val.message && (
                  <div className="text-xs text-red-500 mt-1">{val.message}</div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleViewClick(key)}
            className="flex items-center text-blue-600 hover:underline"
          >
            <Eye className="w-4 h-4 mr-1" /> View
          </button>
        </div>
      ))}
    </div>
  );
};

  const renderAlerts = () => (
    <div className="animate-fadeIn">
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
    </div>
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
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
      {!authenticated ? renderLogin() : (
        <>
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#f0f3f4] to-[#5F8AC7] shadow-md">
            <img 
              src={CoforgeLogoImage} 
              alt="Coforge Logo" 
              className="h-14 w-auto"
            />
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