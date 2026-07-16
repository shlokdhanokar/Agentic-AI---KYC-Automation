import re

with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert API_URL at the top of KYCPortal
content = re.sub(
    r"export default function KYCPortal\(\) \{",
    "export default function KYCPortal() {\n  const API_URL = process.env.REACT_APP_API_URL || '';",
    content
)

# Replace fetch calls
content = re.sub(r"fetch\(`/process-logs/\$\{docId\}`\)", r"fetch(`${API_URL}/process-logs/${docId}`)", content)
content = re.sub(r"fetch\('/upload',", r"fetch(`${API_URL}/upload`,", content)
content = re.sub(r"fetch\('/upload-demo',", r"fetch(`${API_URL}/upload-demo`,", content)
content = re.sub(r"fetch\('/status'", r"fetch(`${API_URL}/status`", content)
content = re.sub(r"fetch\('/alerts'", r"fetch(`${API_URL}/alerts`", content)

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)
