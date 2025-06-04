# app.py
import os
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import pandas as pd
import re

app = Flask(__name__)

# === CONFIGURATION ===
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Azure Blob Storage
connection_string = "DefaultEndpointsProtocol=https;AccountName=doctrainings;AccountKey=nOFJZry+p3BbM1C+fxP5YAJBNJj/Odebs8cgfbBwk9Nu83MSsqcDC9FLpY0yxJrHZn2JC/bEpOoE+AStz+fyLg==;EndpointSuffix=core.windows.net"
container_name = "kyc-image"

# Azure Form Recognizer
form_recognizer_endpoint = "https://mypoc.cognitiveservices.azure.com/"
form_recognizer_key = "d499d3bcebba45058b02c228e0ef3cf4"

# Azure OpenAI
openai_client = AzureOpenAI(
    api_key="Ff0YRHqouo7vFCicY6PNtP1mgr4wtwkc3fsvfdG7LU7cRU9b7rIkJQQJ99BEACYeBjFXJ3w3AAABACOGIM6j",
    api_version="2024-02-01",
    azure_endpoint="https://azuresearchopenapi.openai.azure.com/"
)
deployment_name = "gpt-4o-mini"

# Database file path
DATABASE_FILE = "DATABASE_DOCUMENTS.xlsx"
STATUS_FILE = "extracted_passport_details.xlsx"

# In-memory storage for document status (in production, use a database)
document_status = {}

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

def extract_structured_fields(full_text, openai_client, deployment_name, doc_type):
    if doc_type == "passport":
        prompt = f"""
You are an assistant that extracts structured passport information from OCR text.
Extract the following fields:
- Passport Number
- Surname
- Given Name
- Date of Birth
- Place of Birth
- Date of Expiration
- Sex
- Nationality

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Don't use quotes for every cell.
If only a full name is provided, split the last word as surname.
If a field is not explicitly labeled, infer it from context.
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""
    elif doc_type == "driving_license":
        prompt = f"""
You are an assistant that extracts structured driving license information from OCR text.
Extract the following fields:
- DLN No (Driving License Number)
- Given Name
- Surname
- Date of Birth
- Sex
- DI Expiry (License Expiry Date)
- Address (Complete address from the license)

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Don't use quotes for every cell.
If only a full name is provided, split the last word as surname.
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""
    else:  # identity_card
        prompt = f"""
You are an assistant that extracts structured identity card information from OCR text.
Extract the following fields:
- ID No (Identity Card Number)
- Given Name
- Surname
- Date of Birth
- Sex
- ID Expiry
- Address (Complete address from the ID card)

IMPORTANT: Make sure ALL dates are in "DD/MM/YYYY" format (e.g., "02/07/1977").
Don't use quotes for every cell.
If only a full name is provided, split the last word as surname.
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""

    response = openai_client.chat.completions.create(
        model=deployment_name,
        messages=[
            {"role": "system", "content": "You extract structured document data from OCR text. Always format dates as DD/MM/YYYY."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )
    gpt_response = response.choices[0].message.content
    
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
    passport_no = extracted_data.get('Passport Number', '').strip()
    given_name = extracted_data.get('Given Name', '').strip().upper()
    surname = extracted_data.get('Surname', '').strip().upper()
    
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
    dln_no = extracted_data.get('DLN No', '').strip()
    given_name = extracted_data.get('Given Name', '').strip().upper()
    surname = extracted_data.get('Surname', '').strip().upper()
    
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
    id_no = extracted_data.get('ID No', '').strip()
    given_name = extracted_data.get('Given Name', '').strip().upper()
    surname = extracted_data.get('Surname', '').strip().upper()
    
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

def save_to_excel(data, doc_type, verification_status, verification_message, file_name):
    """Save extracted data to Excel file with DD/MM/YYYY date format"""
    
    # Check if file exists, if not create it with headers
    if not os.path.exists(file_name):
        print(f"File '{file_name}' does not exist. Creating new file with headers...")
        columns = [
            "Passport Number",
            "Driving License Number", 
            "Identity Card Number",
            "Given Name",
            "Surname",
            "Date of Birth",
            "Address/Place of Birth",
            "Date of Expiration",
            "Sex",
            "Verification Status"
        ]
        pd.DataFrame(columns=columns).to_excel(file_name, index=False)
    
    # Determine the correct value for Address/Place of Birth based on document type
    address_place_birth = "-"
    if doc_type == "passport":
        address_place_birth = data.get("Place of Birth", "-")
    elif doc_type == "driving_license":
        address_place_birth = data.get("Address", "-")
    elif doc_type == "identity_card":
        address_place_birth = data.get("Address", "-")
    
    # Format all date fields to DD/MM/YYYY before saving
    date_of_birth = format_date_to_ddmmyyyy(data.get("Date of Birth", "-"))
    date_of_expiration = format_date_to_ddmmyyyy(
        data.get("Date of Expiration", 
                 data.get("DI Expiry", 
                         data.get("ID Expiry", "-")))
    )
    
    # Create record with only the specified columns
    record = {
        "Passport Number": data.get("Passport Number", "-"),
        "Driving License Number": data.get("DLN No", "-"),
        "Identity Card Number": data.get("ID No", "-"),
        "Given Name": data.get("Given Name", "-"),
        "Surname": data.get("Surname", "-"),
        "Date of Birth": date_of_birth,
        "Address/Place of Birth": address_place_birth,
        "Date of Expiration": date_of_expiration,
        "Sex": data.get("Sex", "-"),
        "Verification Status": verification_status
    }
    
    # Create DataFrame with the new record
    new_df = pd.DataFrame([record])
    
    try:
        # Read existing file
        existing_df = pd.read_excel(file_name)
        
        # Append new record
        updated_df = pd.concat([existing_df, new_df], ignore_index=True)
        
        # Save updated DataFrame
        updated_df.to_excel(file_name, index=False)
        
        print(f"✅ Data appended to {file_name} with verification status: {verification_status}")
        
    except Exception as e:
        print(f"⚠️ Error appending to existing Excel file: {e}")
        # If there's an error, just save the new record with headers
        new_df.to_excel(file_name, index=False)
        print(f"✅ Created new file with current record: {file_name}")

    return record

def get_verification_status(document_id):
    """Get verification status from Excel file"""
    try:
        if not os.path.exists(STATUS_FILE):
            return None
        
        df = pd.read_excel(STATUS_FILE)
        if document_id in df.index:
            return df.loc[document_id, 'Verification Status']
        return None
    except Exception as e:
        print(f"Error reading status file: {e}")
        return None

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
        document_status[document_id] = {
            'status': 'uploading',
            'message': 'Document uploaded, processing...',
            'verification_status': None,
            'kyc_completed': False
        }
        
        # Process the file in the background
        from threading import Thread
        thread = Thread(target=process_document, args=(file_path, document_id))
        thread.start()
        
        return jsonify({
            'success': True,
            'documentId': document_id,
            'message': 'File uploaded successfully. Processing...'
        })
    
    return jsonify({'success': False, 'message': 'Invalid file type'}), 400

def process_document(file_path, document_id):
    """Background processing of uploaded document"""
    try:
        # Load database sheets
        database_sheets = load_database_sheets()
        if not database_sheets:
            document_status[document_id] = {
                'status': 'error',
                'message': 'Failed to load database',
                'verification_status': None,
                'kyc_completed': False
            }
            return
        
        # Update status to uploading to blob
        document_status[document_id] = {
            'status': 'uploading_to_blob',
            'message': 'Uploading document to Azure Blob Storage...',
            'verification_status': None,
            'kyc_completed': False
        }
        
        # Upload to Azure Blob Storage
        blob_url = upload_to_blob(file_path, container_name, connection_string)
        
        # Update status to extracting text
        document_status[document_id] = {
            'status': 'extracting_text',
            'message': 'Extracting text from document...',
            'verification_status': None,
            'kyc_completed': False
        }
        
        # Extract OCR text
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        
        # Determine document type
        doc_type = determine_document_type(ocr_text)
        
        # Update status to extracting structured data
        document_status[document_id] = {
            'status': 'extracting_structured_data',
            'message': 'Extracting structured data from document...',
            'verification_status': None,
            'kyc_completed': False
        }
        
        # Extract structured data based on document type
        structured_data = extract_structured_fields(ocr_text, openai_client, deployment_name, doc_type)
        
        # Update status to verifying data
        document_status[document_id] = {
            'status': 'verifying_data',
            'message': 'Verifying document data against database...',
            'verification_status': None,
            'kyc_completed': False
        }
        
        # Verify extracted data against database
        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        # Save to Excel
        record = save_to_excel(structured_data, doc_type, verification_status, verification_message, STATUS_FILE)
        
        # Update final status
        document_status[document_id] = {
            'status': 'completed',
            'message': verification_message,
            'verification_status': verification_status,
            'kyc_completed': verification_status == 'VALID',
            'document_type': doc_type,
            'document_data': structured_data,
            'record': record
        }
        
        # Clean up the uploaded file
        os.remove(file_path)
        
    except Exception as e:
        document_status[document_id] = {
            'status': 'error',
            'message': str(e),
            'verification_status': None,
            'kyc_completed': False
        }

@app.route('/status/<document_id>', methods=['GET'])
def check_status(document_id):
    """Check the status of document processing"""
    if document_id not in document_status:
        return jsonify({'status': 'not_found', 'message': 'Document ID not found'}), 404
    
    # Get the current status
    status_info = document_status[document_id]
    
    # If processing is completed, get the verification status from Excel
    if status_info['status'] == 'completed':
        try:
            if os.path.exists(STATUS_FILE):
                df = pd.read_excel(STATUS_FILE)
                # Find the most recent record for this document (assuming it's the last one)
                if not df.empty:
                    latest_record = df.iloc[-1].to_dict()
                    status_info['verification_status'] = latest_record.get('Verification Status', 'UNKNOWN')
                    status_info['kyc_completed'] = status_info['verification_status'] == 'VALID'
        except Exception as e:
            print(f"Error reading status file: {e}")
    
    return jsonify(status_info)

@app.route('/status', methods=['GET'])
def get_all_status():
    """Get status of all documents"""
    try:
        if not os.path.exists(STATUS_FILE):
            return jsonify([])
        
        df = pd.read_excel(STATUS_FILE)
        # Replace NaN values with None for proper JSON serialization
        df = df.where(pd.notnull(df), None)
        # Convert DataFrame to list of dictionaries
        records = df.to_dict('records')
        return jsonify(records)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/alerts', methods=['GET'])
def get_alerts():
    """Get alerts from the system"""
    try:
        if not os.path.exists(STATUS_FILE):
            return jsonify([])
        
        df = pd.read_excel(STATUS_FILE)
        # Filter only invalid records
        alerts = df[df['Verification Status'] == 'INVALID'].to_dict('records')
        
        # Format alerts with severity
        formatted_alerts = []
        for alert in alerts:
            formatted_alerts.append({
                'type': 'Verification Failed',
                'message': f"Document verification failed for {alert.get('Given Name', '')} {alert.get('Surname', '')}",
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'severity': 'High',
                'document_type': 'Passport' if alert.get('Passport Number', '-') != '-' else 
                                'Driving License' if alert.get('Driving License Number', '-') != '-' else 
                                'Identity Card'
            })
        
        return jsonify(formatted_alerts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# === FRONTEND SERVING ===
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    # Create uploads directory if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, port=5000)