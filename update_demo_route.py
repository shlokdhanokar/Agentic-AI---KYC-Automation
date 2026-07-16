with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """@app.route('/upload-demo', methods=['POST'])
def upload_demo():
    \"\"\"Upload a pre-existing demo document for recruiter testing\"\"\"
    import shutil
    demo_path = os.path.join(app.root_path, DEMO_FILE)
    if not os.path.exists(demo_path):
        return jsonify({'success': False, 'message': 'Demo file not found on server'}), 404

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    dest_path = os.path.join(app.config['UPLOAD_FOLDER'], DEMO_FILE)
    shutil.copy2(demo_path, dest_path)"""

replacement = """@app.route('/upload-demo', methods=['POST'])
def upload_demo():
    \"\"\"Upload a pre-existing demo document for recruiter testing\"\"\"
    import shutil
    
    # Get requested document type from body if available
    req_data = request.get_json(silent=True) or {}
    doc_type = req_data.get('docType', 'license')
    
    demo_files = {
        'passport': 'demo-passport.png',
        'license': 'demo-dl.png',
        'idCard': 'demo-id.png'
    }
    
    demo_filename = demo_files.get(doc_type, 'demo-dl.png')
    demo_path = os.path.join(app.root_path, demo_filename)
    
    if not os.path.exists(demo_path):
        # Fallback to the old file if needed
        demo_path = os.path.join(app.root_path, "Philip DL.PNG")
        demo_filename = "Philip DL.PNG"
        if not os.path.exists(demo_path):
            return jsonify({'success': False, 'message': 'Demo file not found on server'}), 404

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Create unique filename to prevent collisions in Celery workers
    unique_filename = f"{uuid.uuid4().hex}_{demo_filename}"
    dest_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    
    shutil.copy2(demo_path, dest_path)"""

content = content.replace(target, replacement)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
