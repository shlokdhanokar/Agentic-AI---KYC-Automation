with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """    if (filesToUpload.length === 0) {
      alert('Please upload at least one document');
      return;
    }

    setUploading(true);
    setShowConsole(true);
    setAgentLogs([{ text: `[System] KYC Pipeline initialized \\u2014 ${filesToUpload.length} document(s) queued`, time: new Date().toLocaleTimeString() }]);
    setAgentProgress({
      agent1: { name: "Document Processing", progress: 0, status: "processing" },
      agent2: { name: "Validation", progress: 0, status: "idle" },
      kycComplete: { name: "KYC Complete", progress: 0, status: "idle" }
    });"""

replacement1 = """    if (filesToUpload.length === 0) {
      alert('Please upload at least one document');
      return;
    }

    setUploading(true);
    setShowConsole(true);
    setAgentLogs([{ text: `[System] KYC Pipeline initialized \\u2014 ${filesToUpload.length} document(s) queued`, time: new Date().toLocaleTimeString() }]);
    setAgentProgress({
      agent1: { name: "Document Processing", progress: 0, status: "processing" },
      agent2: { name: "Validation", progress: 0, status: "idle" },
      agent3: { name: "OFAC Screening", progress: 0, status: "idle" },
      kycComplete: { name: "KYC Complete", progress: 0, status: "idle" }
    });"""
content = content.replace(target1, replacement1)

target2 = """        if (latestResult && latestResult.status === 'completed') {
          setAgentProgress({
            agent1: { name: "Document Processing", progress: 100, status: "completed" },
            agent2: { name: "Validation", progress: 100, status: latestResult.verification_status === 'VALID' ? "completed" : "invalid", message: latestResult.message },
            kycComplete: { name: "KYC Complete", progress: latestResult.kyc_completed ? 100 : 50, status: latestResult.kyc_completed ? "completed" : "incomplete" }
          });"""

replacement2 = """        if (latestResult && latestResult.status === 'completed') {
          setAgentProgress({
            agent1: { name: "Document Processing", progress: 100, status: "completed" },
            agent2: { name: "Validation", progress: 100, status: (latestResult.verification_status === 'VALID' || (latestResult.verification_status === 'INVALID' && latestResult.message?.includes('OFAC'))) ? "completed" : "invalid" },
            agent3: { name: "OFAC Screening", progress: 100, status: latestResult.verification_status === 'VALID' ? "completed" : (latestResult.message?.includes('OFAC') ? "invalid" : "idle"), message: latestResult.message },
            kycComplete: { name: "KYC Complete", progress: latestResult.kyc_completed ? 100 : 50, status: latestResult.kyc_completed ? "completed" : "incomplete" }
          });"""
content = content.replace(target2, replacement2)

target3 = """  const handleDemoUpload = async () => {
    setUploading(true);
    setShowConsole(true);
    setAgentLogs([{ text: '[System] Demo mode — Loading sample document...', time: new Date().toLocaleTimeString() }]);
    setActiveTab("upload");

    try {
      const response = await fetch(`${API_URL}/upload-demo`, { method: 'POST' });
      const data = await response.json();

      if (data.success && data.documentId) {
        setPollingDocIds({ demo: data.documentId });
      } else {
        setAgentLogs(prev => [...prev, { text: `[Error] ✗ ${data.message}`, time: new Date().toLocaleTimeString(), error: true }]);
        setUploading(false);
      }
    } catch (error) {
      setAgentLogs(prev => [...prev, { text: `[Error] ✗ Network error: ${error.message}`, time: new Date().toLocaleTimeString(), error: true }]);
      setUploading(false);
    }
  };"""

replacement3 = """  const handleDemoUpload = async () => {
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
  };"""
content = content.replace(target3, replacement3)

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)
