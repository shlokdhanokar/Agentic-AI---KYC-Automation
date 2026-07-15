# app.py
import os
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import google.generativeai as genai
from dotenv import load_dotenv
import pandas as pd
import re
from celery import Celery
import database

load_dotenv()

app = Flask(__name__, static_folder='build/static', static_url_path='/static')
CORS(app)  # Enable CORS for all routes

def make_celery(app_name=__name__):
    redis_url = os.environ.get('REDIS_URL')
    if not redis_url:
        raise ValueError('REDIS_URL is not set')
    celery_url = redis_url
    if celery_url.startswith('rediss://') and 'ssl_cert_reqs' not in celery_url:
        celery_url += '?ssl_cert_reqs=CERT_NONE'
    return Celery(app_name, backend=celery_url, broker=celery_url)
celery = make_celery()

# === CONFIGURATION ===
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Azure Blob Storage
connection_string = os.environ.get("AZURE_BLOB_CONNECTION_STRING")
container_name = os.environ.get("AZURE_BLOB_CONTAINER_NAME", "kyc-image")

# Azure Form Recognizer
form_recognizer_endpoint = os.environ.get("AZURE_FORM_RECOGNIZER_ENDPOINT")
form_recognizer_key = os.environ.get("AZURE_FORM_RECOGNIZER_KEY")

# Google Gemini Configuration
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

# Database file path
DATABASE_FILE = "DATABASE_DOCUMENTS.xlsx"


# === HELPER FUNCTIONS ===
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def format_date_to_ddmmyyyy(date_str):
    """Convert any date format to DD/MM/YYYY"""
    if not date_str or date_str == "-" or str(date_str).strip() == "":
        return "-"
    
    date_str = str(date_str).strip()
    
    # Common date patterns
    patterns = [
        r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',  # DD/MM/YYYY or DD-MM-YYYY
        r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',  # YYYY/MM/DD or YYYY-MM-DD
        r'(\d{1,2})\s+(\w{3})\s+(\d{4})',      # DD MMM YYYY (e.g., 02 Jul 1977)
        r'(\w{3})\s+(\d{1,2}),?\s+(\d{4})',    # MMM DD, YYYY (e.g., Jul 02, 1977)
        r'(\d{1,2})\s+(\w+)\s+(\d{4})',        # DD Month YYYY (e.g., 02 July 1977)
        r'(\w+)\s+(\d{1,2}),?\s+(\d{4})'       # Month DD, YYYY (e.g., July 02, 1977)
    ]
    
    # Month name to number mapping
    months = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
    }
    
    for pattern in patterns:
        match = re.search(pattern, date_str.lower())
        if match:
            groups = match.groups()
            
            if pattern == patterns[0]:  # DD/MM/YYYY or DD-MM-YYYY
                day, month, year = groups
                return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
            
            elif pattern == patterns[1]:  # YYYY/MM/DD or YYYY-MM-DD
                year, month, day = groups
                return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
            
            elif pattern == patterns[2]:  # DD MMM YYYY
                day, month_abbr, year = groups
                month_num = months.get(month_abbr.lower(), '01')
                return f"{day.zfill(2)}/{month_num}/{year}"
            
            elif pattern == patterns[3]:  # MMM DD, YYYY
                month_abbr, day, year = groups
                month_num = months.get(month_abbr.lower(), '01')
                return f"{day.zfill(2)}/{month_num}/{year}"
            
            elif pattern == patterns[4]:  # DD Month YYYY
                day, month_name, year = groups
                month_num = months.get(month_name.lower(), '01')
                return f"{day.zfill(2)}/{month_num}/{year}"
            
            elif pattern == patterns[5]:  # Month DD, YYYY
                month_name, day, year = groups
                month_num = months.get(month_name.lower(), '01')
                return f"{day.zfill(2)}/{month_num}/{year}"
    
    # If no pattern matches, return original string
    return date_str

def upload_to_blob(file_path, container_name, connection_string):
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_client = blob_service_client.get_container_client(container_name)
    if not container_client.exists():
        container_client.create_container()
    file_name = os.path.basename(file_path)
    blob_client = container_client.get_blob_client(file_name)
    with open(file_path, "rb") as data:
        blob_client.upload_blob(data, overwrite=True)
    print(f"{file_name} uploaded to container '{container_name}'.")
    sas_token = generate_blob_sas(
        account_name=blob_service_client.account_name,
        container_name=container_name,
        blob_name=file_name,
        account_key=blob_service_client.credential.account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=1)
    )
    return f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{file_name}?{sas_token}"

def extract_ocr_text(blob_url, endpoint, key):
    client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    poller = client.begin_analyze_document_from_url("prebuilt-read", document_url=blob_url)
    result = poller.result()
    return "\n".join([line.content for page in result.pages for line in page.lines])

def determine_document_type(full_text):
    """Determine document type based on OCR text content"""
    text_lower = full_text.lower()
    
    # Check for passport indicators
    passport_indicators = ['passport', 'passeport', 'republic', 'type p', 'passport no', 'passport number']
    
    # Check for driving license indicators
    dl_indicators = ['driving license', 'driver license', 'driver\'s license', 'dl no', 'license no', 'driving licence']
    
    # Check for ID card indicators
    id_indicators = ['identity card', 'id card', 'identification', 'national id', 'citizen id']
    
    passport_score = sum(1 for indicator in passport_indicators if indicator in text_lower)
    dl_score = sum(1 for indicator in dl_indicators if indicator in text_lower)
    id_score = sum(1 for indicator in id_indicators if indicator in text_lower)
    
    if passport_score >= dl_score and passport_score >= id_score:
        return "passport"
    elif dl_score >= id_score:
        return "driving_license"
    else:
        return "identity_card"

def extract_structured_fields(full_text, doc_type):
    if doc_type == "passport":
        prompt = f"""
You are an assistant that extracts structured passport information from OCR text.
Extract the following fields using these EXACT JSON keys:
- "Passport No"
- "Given Name"
- "Surname"
- "Date of Birth"
- "Place of Birth"
- "Date of Expiration"
- "Sex"
- "Nationality"

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""
    elif doc_type == "driving_license":
        prompt = f"""
You are an assistant that extracts structured driving license information from OCR text.
Extract the following fields using these EXACT JSON keys:
- "DLN No"
- "Given Name"
- "Surname"
- "Date of Birth"
- "Sex"
- "DI Expiry"
- "Address"

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""
    else:  # identity_card
        prompt = f"""
You are an assistant that extracts structured ID card information from OCR text.
Extract the following fields using these EXACT JSON keys:
- "ID Number"
- "Given Name"
- "Surname"
- "Date of Birth"
- "Sex"
- "Date of Expiry"
- "Address"

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""

    # Using Gemini
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Prepend the system instructions to the prompt
    full_prompt = "You extract structured document data from OCR text. Always format dates as DD/MM/YYYY.\n\n" + prompt
    
    try:
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.2)
        )
        gpt_response = response.text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        gpt_response = "{}"
    
    try:
        extracted_data = json.loads(gpt_response)
    except json.JSONDecodeError:
        extracted_data = {}
        for line in gpt_response.splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                extracted_data[key.strip()] = value.strip()

    # Format all date fields to DD/MM/YYYY
    date_fields = ['Date of Birth', 'Date of Expiration', 'DI Expiry', 'ID Expiry']
    for field in date_fields:
        if field in extracted_data:
            extracted_data[field] = format_date_to_ddmmyyyy(extracted_data[field])

    return extracted_data

def load_database_sheets():
    """Load all sheets from DATABASE_DOCUMENTS.xlsx"""
    try:
        # Load Excel file sheets
        xl_file = pd.ExcelFile(DATABASE_FILE)
        
        # Load the first sheet (assuming it contains passport data based on your original data)
        passport_df = pd.read_excel(DATABASE_FILE, sheet_name=0)
        
        # Try to load other sheets if they exist
        dl_df = None
        id_df = None
        
        for sheet_name in xl_file.sheet_names:
            if 'dl' in sheet_name.lower() or 'driving' in sheet_name.lower():
                dl_df = pd.read_excel(DATABASE_FILE, sheet_name=sheet_name)
            elif 'id' in sheet_name.lower() or 'identity' in sheet_name.lower():
                id_df = pd.read_excel(DATABASE_FILE, sheet_name=sheet_name)
        
        # If specific sheets don't exist, create empty DataFrames or use the main sheet
        if dl_df is None:
            dl_df = pd.DataFrame()
        if id_df is None:
            id_df = pd.DataFrame()
        
        return {
            'passport': passport_df,
            'driving_license': dl_df,
            'identity_card': id_df
        }
    except Exception as e:
        print(f"Error loading database: {e}")
        return None

def verify_passport_data(extracted_data, passport_df):
    """Verify passport data against database"""
    passport_no = extracted_data.get('Passport Number', extracted_data.get('Passport No', extracted_data.get('Passport', ''))).strip()
    given_name = extracted_data.get('Given Name', extracted_data.get('First Name', '')).strip().upper()
    surname = extracted_data.get('Surname', extracted_data.get('Last Name', '')).strip().upper()
    
    if not passport_no:
        return "INVALID", "Passport number not found"
    
    # Try multiple matching approaches
    # Method 1: Direct string comparison
    matching_records = passport_df[passport_df['Passport No.'].astype(str).str.strip() == passport_no]
    
    # Method 2: If no match, try with leading zeros removed
    if matching_records.empty:
        passport_no_no_zeros = passport_no.lstrip('0')
        matching_records = passport_df[passport_df['Passport No.'].astype(str).str.strip().str.lstrip('0') == passport_no_no_zeros]
    
    # Method 3: If no match, try numeric comparison (if applicable)
    if matching_records.empty:
        try:
            passport_no_int = int(passport_no)
            matching_records = passport_df[passport_df['Passport No.'].astype(str).str.strip().astype(int) == passport_no_int]
        except ValueError:
            pass
    
    if matching_records.empty:
        return "INVALID", f"Passport number {passport_no} not found in database"
    
    record = matching_records.iloc[0]
    
    # Verify name fields
    db_given_name = str(record['Given Name']).strip().upper()
    db_surname = str(record['Surname']).strip().upper()
    
    if given_name != db_given_name or surname != db_surname:
        return "INVALID", f"Name mismatch: Expected '{db_given_name} {db_surname}', got '{given_name} {surname}'"
    
    return "VALID", "All data matches database record"

def verify_dl_data(extracted_data, dl_df):
    """Verify driving license data against database"""
    dln_no = extracted_data.get('DLN No', extracted_data.get('Driving License Number', extracted_data.get('DLN', extracted_data.get('License No', '')))).strip()
    given_name = extracted_data.get('Given Name', extracted_data.get('First Name', '')).strip().upper()
    surname = extracted_data.get('Surname', extracted_data.get('Last Name', '')).strip().upper()
    
    if not dln_no:
        return "INVALID", "DLN number not found"
    
    # Check for different possible column names for DLN number
    dln_column = None
    if 'DLN No.' in dl_df.columns:
        dln_column = 'DLN No.'
    elif 'DLN NO.' in dl_df.columns:
        dln_column = 'DLN NO.'
    elif 'DLN No' in dl_df.columns:
        dln_column = 'DLN No'
    elif 'DL No.' in dl_df.columns:
        dln_column = 'DL No.'
    elif 'DL NO.' in dl_df.columns:
        dln_column = 'DL NO.'
    
    if not dln_column:
        return "INVALID", "DLN number column not found in database"
    
    # Try multiple matching approaches
    # Method 1: Direct string comparison
    matching_records = dl_df[dl_df[dln_column].astype(str).str.strip() == dln_no]
    
    # Method 2: If no match, try with leading zeros removed
    if matching_records.empty:
        dln_no_no_zeros = dln_no.lstrip('0')
        matching_records = dl_df[dl_df[dln_column].astype(str).str.strip().str.lstrip('0') == dln_no_no_zeros]
    
    # Method 3: If no match, try numeric comparison (if applicable)
    if matching_records.empty:
        try:
            dln_no_int = int(dln_no)
            matching_records = dl_df[dl_df[dln_column].astype(str).str.strip().astype(int) == dln_no_int]
        except ValueError:
            pass
    
    if matching_records.empty:
        return "INVALID", f"DLN number {dln_no} not found in database"
    
    record = matching_records.iloc[0]
    
    # Verify name fields
    db_given_name = str(record['Given Name']).strip().upper()
    db_surname = str(record['Surname']).strip().upper()
    
    if given_name != db_given_name or surname != db_surname:
        return "INVALID", f"Name mismatch: Expected '{db_given_name} {db_surname}', got '{given_name} {surname}'"
    
    return "VALID", "All data matches database record"

def verify_id_data(extracted_data, id_df):
    """Verify identity card data against database"""
    id_no = extracted_data.get('ID No', extracted_data.get('Identity Card Number', extracted_data.get('ID Number', ''))).strip()
    given_name = extracted_data.get('Given Name', extracted_data.get('First Name', '')).strip().upper()
    surname = extracted_data.get('Surname', extracted_data.get('Last Name', '')).strip().upper()
    
    if not id_no:
        return "INVALID", "ID number not found"
    
    # Check for different possible column names for ID number
    id_column = None
    if 'ID NO.' in id_df.columns:
        id_column = 'ID NO.'
    elif 'ID No.' in id_df.columns:
        id_column = 'ID No.'
    elif 'ID No' in id_df.columns:
        id_column = 'ID No'
    elif 'ID_NO' in id_df.columns:
        id_column = 'ID_NO'
    
    if not id_column:
        return "INVALID", "ID number column not found in database"
    
    # Try multiple matching approaches
    # Method 1: Direct string comparison
    matching_records = id_df[id_df[id_column].astype(str).str.strip() == id_no]
    
    # Method 2: If no match, try with leading zeros removed
    if matching_records.empty:
        id_no_no_zeros = id_no.lstrip('0')
        matching_records = id_df[id_df[id_column].astype(str).str.strip().str.lstrip('0') == id_no_no_zeros]
    
    # Method 3: If no match, try numeric comparison (if applicable)
    if matching_records.empty:
        try:
            id_no_int = int(id_no)
            matching_records = id_df[id_df[id_column].astype(str).str.strip().astype(int) == id_no_int]
        except ValueError:
            pass
    
    if matching_records.empty:
        return "INVALID", f"ID number {id_no} not found in database"
    
    record = matching_records.iloc[0]
    
    # Verify name fields
    db_given_name = str(record['Given Name']).strip().upper()
    db_surname = str(record['Surname']).strip().upper()
    
    if given_name != db_given_name or surname != db_surname:
        return "INVALID", f"Name mismatch: Expected '{db_given_name} {db_surname}', got '{given_name} {surname}'"
    
    return "VALID", "All data matches database record"

def verify_extracted_data(extracted_data, doc_type, database_sheets):
    """Main verification function"""
    if not database_sheets:
        return "ERROR", "Database not loaded"
    
    if doc_type == "passport":
        return verify_passport_data(extracted_data, database_sheets['passport'])
    elif doc_type == "driving_license":
        return verify_dl_data(extracted_data, database_sheets['driving_license'])
    elif doc_type == "identity_card":
        return verify_id_data(extracted_data, database_sheets['identity_card'])
    else:
        return "ERROR", "Unknown document type"

# === API ENDPOINTS ===
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Create uploads directory if it doesn't exist
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        file.save(file_path)
        
        # Generate a unique document ID
        document_id = str(uuid.uuid4())
        
        # Initialize document status
        database.save_document_status(document_id, {
            'status': 'uploading',
            'message': 'Document uploaded, processing...',
            'verification_status': None,
            'kyc_completed': False
        })
        
        # Process the file in the background
        process_document.delay(file_path, document_id)
        
        return jsonify({
            'success': True,
            'documentId': document_id,
            'message': 'File uploaded successfully. Processing...'
        })
    
    return jsonify({'success': False, 'message': 'Invalid file type'}), 400


# Demo document for recruiter testing
DEMO_FILE = "Philip DL.PNG"

@app.route('/upload-demo', methods=['POST'])
def upload_demo():
    """Upload a pre-existing demo document for recruiter testing"""
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
    """Background processing of uploaded document"""
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
    """Background processing with step-by-step logging for the Agent Console"""
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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
