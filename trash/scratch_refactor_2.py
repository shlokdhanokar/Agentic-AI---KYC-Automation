import re

def rewrite_bottom_half():
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the index of "def process_document(file_path, document_id):"
    # Actually, because of our previous replacement, it might be "@celery.task(name='app.process_document')\ndef process_document(file_path, document_id):"
    # or just "def process_document(file_path, document_id):" if it failed.
    # Let's search for "def process_document("
    
    match = re.search(r'def process_document\(file_path, document_id\):', content)
    if not match:
        print("Could not find process_document")
        return
        
    top_half = content[:match.start()]
    
    # We will also need to fix upload_demo which we didn't touch yet.
    # Let's clean up top_half to remove upload_demo and process_document
    match_demo = re.search(r'# Demo document for recruiter testing', top_half)
    if match_demo:
        top_half = top_half[:match_demo.start()]
        
    # Also we need to clean up check_status and get_all_status and get_alerts if they are in top_half
    match_status = re.search(r'@app\.route\(\'/status/<document_id>\', methods=\[\'GET\'\]\)', top_half)
    if match_status:
        top_half = top_half[:match_status.start()]
        
    bottom_half = """
# Demo document for recruiter testing
DEMO_FILE = "Philip DL.PNG"

@app.route('/upload-demo', methods=['POST'])
def upload_demo():
    \"\"\"Upload a pre-existing demo document for recruiter testing\"\"\"
    import shutil
    demo_path = os.path.join(app.root_path, DEMO_FILE)
    if not os.path.exists(demo_path):
        return jsonify({'success': False, 'message': 'Demo file not found on server'}), 404

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    dest_path = os.path.join(app.config['UPLOAD_FOLDER'], DEMO_FILE)
    shutil.copy2(demo_path, dest_path)

    document_id = str(uuid.uuid4())

    database.save_document_status(document_id, {
        'status': 'uploading',
        'message': 'Demo document uploaded, processing...',
        'verification_status': None,
        'kyc_completed': False,
        'logs': [
            {'step': 'init', 'text': '[System] KYC Pipeline initialized', 'done': True}
        ]
    })

    process_document_with_logs.delay(dest_path, document_id)

    return jsonify({
        'success': True,
        'documentId': document_id,
        'message': 'Demo file uploaded successfully. Processing...'
    })

@celery.task(name='app.process_document')
def process_document(file_path, document_id):
    \"\"\"Background processing of uploaded document\"\"\"
    try:
        database_sheets = load_database_sheets()
        if not database_sheets:
            status = database.get_document_status(document_id) or {}
            status.update({'status': 'error', 'message': 'Failed to load database'})
            database.save_document_status(document_id, status)
            return
        
        status = database.get_document_status(document_id) or {}
        status.update({'status': 'uploading_to_blob', 'message': 'Uploading document to Azure Blob Storage...'})
        database.save_document_status(document_id, status)
        
        blob_url = upload_to_blob(file_path, container_name, connection_string)
        
        status.update({'status': 'extracting_text', 'message': 'Extracting text from document...'})
        database.save_document_status(document_id, status)
        
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        doc_type = determine_document_type(ocr_text)
        
        status.update({'status': 'extracting_structured_data', 'message': 'Extracting structured data from document...'})
        database.save_document_status(document_id, status)
        
        structured_data = extract_structured_fields(ocr_text, doc_type)
        
        status.update({'status': 'verifying_data', 'message': 'Verifying document data against database...'})
        database.save_document_status(document_id, status)
        
        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        # Save final record to Redis instead of Excel
        record_data = {
            "Passport Number": structured_data.get("Passport Number", "-"),
            "Driving License Number": structured_data.get("DLN No", "-"),
            "Identity Card Number": structured_data.get("ID No", "-"),
            "Given Name": structured_data.get("Given Name", "-"),
            "Surname": structured_data.get("Surname", "-"),
            "Date of Birth": format_date_to_ddmmyyyy(structured_data.get("Date of Birth", "-")),
            "Address/Place of Birth": structured_data.get("Place of Birth", structured_data.get("Address", "-")),
            "Date of Expiration": format_date_to_ddmmyyyy(structured_data.get("Date of Expiration", structured_data.get("DI Expiry", structured_data.get("ID Expiry", "-")))),
            "Sex": structured_data.get("Sex", "-"),
            "Verification Status": verification_status
        }
        database.save_final_record(document_id, record_data)
        
        status.update({
            'status': 'completed',
            'message': verification_message,
            'verification_status': verification_status,
            'kyc_completed': verification_status == 'VALID',
            'document_type': doc_type,
            'document_data': structured_data,
            'record': record_data
        })
        database.save_document_status(document_id, status)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            
    except Exception as e:
        status = database.get_document_status(document_id) or {}
        status.update({'status': 'error', 'message': str(e)})
        database.save_document_status(document_id, status)

def add_log(document_id, text, error=False):
    import time
    log_entry = {
        'text': text,
        'time': datetime.now().strftime('%H:%M:%S'),
        'error': error
    }
    database.add_log_to_document(document_id, log_entry)

@celery.task(name='app.process_document_with_logs')
def process_document_with_logs(file_path, document_id):
    \"\"\"Background processing with step-by-step logging for the Agent Console\"\"\"
    try:
        add_log(document_id, '[Database] Loading customer records from Excel database...')
        database_sheets = load_database_sheets()
        if not database_sheets:
            add_log(document_id, '[Database] ✗ Failed to load database', error=True)
            status = database.get_document_status(document_id) or {}
            status['status'] = 'error'
            database.save_document_status(document_id, status)
            return
        add_log(document_id, '[Database] ✓ Customer database loaded successfully')

        add_log(document_id, '[Azure Blob] Uploading document to cloud storage...')
        status = database.get_document_status(document_id) or {}
        status['status'] = 'uploading_to_blob'
        database.save_document_status(document_id, status)
        blob_url = upload_to_blob(file_path, container_name, connection_string)
        add_log(document_id, '[Azure Blob] ✓ Document uploaded to Azure Blob Storage')

        add_log(document_id, '[Form Recognizer] Sending document for OCR text extraction...')
        status = database.get_document_status(document_id)
        status['status'] = 'extracting_text'
        database.save_document_status(document_id, status)
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        add_log(document_id, '[Form Recognizer] ✓ Raw text extracted from document')

        add_log(document_id, '[AI Agent] Analyzing document type...')
        doc_type = determine_document_type(ocr_text)
        add_log(document_id, f'[AI Agent] ✓ Document classified as: {doc_type}')

        add_log(document_id, '[Gemini AI] Extracting structured fields from OCR text...')
        status = database.get_document_status(document_id)
        status['status'] = 'extracting_structured_data'
        database.save_document_status(document_id, status)
        structured_data = extract_structured_fields(ocr_text, doc_type)
        print(f"[{document_id}] Extracted Data from Gemini: {structured_data}")
        if structured_data:
            fields = ', '.join([k for k, v in structured_data.items() if v and v != '-'][:4])
            add_log(document_id, f'[Gemini AI] ✓ Fields extracted: {fields}...')
        else:
            add_log(document_id, '[Gemini AI] ✓ Structured data extraction complete')

        add_log(document_id, '[Verification Agent] Cross-referencing extracted data with database records...')
        status = database.get_document_status(document_id)
        status['status'] = 'verifying_data'
        database.save_document_status(document_id, status)
        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        if verification_status == 'VALID':
            add_log(document_id, '[Verification Agent] ✓ Document VALID — data matches database records')
        else:
            add_log(document_id, f'[Verification Agent] ✗ Document INVALID — {verification_message}')

        add_log(document_id, '[System] Saving verification results to database...')
        record_data = {
            "Passport Number": structured_data.get("Passport Number", "-"),
            "Driving License Number": structured_data.get("DLN No", "-"),
            "Identity Card Number": structured_data.get("ID No", "-"),
            "Given Name": structured_data.get("Given Name", "-"),
            "Surname": structured_data.get("Surname", "-"),
            "Date of Birth": format_date_to_ddmmyyyy(structured_data.get("Date of Birth", "-")),
            "Address/Place of Birth": structured_data.get("Place of Birth", structured_data.get("Address", "-")),
            "Date of Expiration": format_date_to_ddmmyyyy(structured_data.get("Date of Expiration", structured_data.get("DI Expiry", structured_data.get("ID Expiry", "-")))),
            "Sex": structured_data.get("Sex", "-"),
            "Verification Status": verification_status
        }
        database.save_final_record(document_id, record_data)
        add_log(document_id, '[System] ✓ Results saved to Redis')

        if verification_status == 'VALID':
            add_log(document_id, '[KYC Decision] ✓ KYC APPROVED — All checks passed')
        else:
            add_log(document_id, f'[KYC Decision] ✗ KYC REJECTED — {verification_message}')

        status = database.get_document_status(document_id)
        status.update({
            'status': 'completed',
            'message': verification_message,
            'verification_status': verification_status,
            'kyc_completed': verification_status == 'VALID',
            'document_type': doc_type,
            'document_data': structured_data,
            'record': record_data
        })
        database.save_document_status(document_id, status)

        if os.path.exists(file_path):
            os.remove(file_path)

    except Exception as e:
        add_log(document_id, f'[Error] ✗ Processing failed: {str(e)}', error=True)
        status = database.get_document_status(document_id) or {}
        status.update({'status': 'error', 'message': str(e)})
        database.save_document_status(document_id, status)

@app.route('/status/<document_id>', methods=['GET'])
def check_status(document_id):
    status_info = database.get_document_status(document_id)
    if not status_info:
        return jsonify({'status': 'not_found', 'message': 'Document ID not found'}), 404
    return jsonify(status_info)

@app.route('/status', methods=['GET'])
def get_all_status():
    records = database.get_all_records()
    return jsonify(records)

@app.route('/alerts', methods=['GET'])
def get_alerts_endpoint():
    alerts = database.get_alerts()
    return jsonify(alerts)

@app.route('/process-logs/<document_id>', methods=['GET'])
def get_process_logs(document_id):
    info = database.get_document_status(document_id)
    if not info:
        return jsonify({'status': 'not_found', 'logs': []}), 404

    return jsonify({
        'status': info.get('status', 'unknown'),
        'logs': info.get('logs', []),
        'verification_status': info.get('verification_status'),
        'kyc_completed': info.get('kyc_completed', False),
        'document_type': info.get('document_type'),
        'document_data': info.get('document_data'),
        'message': info.get('message')
    })

# === FRONTEND SERVING ===
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.root_path, 'build', path)):
        return send_from_directory(os.path.join(app.root_path, 'build'), path)
    else:
        return send_from_directory(os.path.join(app.root_path, 'build'), 'index.html')

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, port=5000)
"""

    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(top_half + bottom_half)

if __name__ == '__main__':
    rewrite_bottom_half()
