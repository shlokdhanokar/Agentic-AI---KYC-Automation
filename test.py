import os
import json
from datetime import datetime, timedelta
from tabulate import tabulate
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import pandas as pd
from openpyxl import load_workbook
import re
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import uuid
from flask_cors import CORS  # Add this import at the top of test.py
# === CONFIGURATION ===
connection_string = "DefaultEndpointsProtocol=https;AccountName=doctrainings;AccountKey=nOFJZry+p3BbM1C+fxP5YAJBNJj/Odebs8cgfbBwk9Nu83MSsqcDC9FLpY0yxJrHZn2JC/bEpOoE+AStz+fyLg==;EndpointSuffix=core.windows.net"
container_name = "kyc-image"

def normalize_path(path):
    return os.path.normpath(path)
# === FLASK APP SETUP ===
app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# Input documents - now accepting three files
passport_path = normalize_path(r"C:\Users\hp\Desktop\Coforge\kyc\Document_Dataset\Document_Dataset\Sorted Passport\Lynn Passport.png")
dl_path = normalize_path(r"C:\Users\hp\Desktop\Coforge\kyc\Document_Dataset\Document_Dataset\Sorted DL\Lynn DL.png")
id_path = normalize_path(r"C:\Users\hp\Desktop\Coforge\kyc\Document_Dataset\Document_Dataset\Sorted ID\Lynn ID.png")

form_recognizer_endpoint = "https://mypoc.cognitiveservices.azure.com/"
form_recognizer_key = "d499d3bcebba45058b02c228e0ef3cf4"

openai_client = AzureOpenAI(
    api_key="Ff0YRHqouo7vFCicY6PNtP1mgr4wtwkc3fsvfdG7LU7cRU9b7rIkJQQJ99BEACYeBjFXJ3w3AAABACOGIM6j",
    api_version="2024-02-01",
    azure_endpoint="https://azuresearchopenapi.openai.azure.com/"
)
deployment_name = "gpt-4o-mini"

# Database file path
DATABASE_FILE = "DATABASE_DOCUMENTS.xlsx"

# === DATE FORMATTING FUNCTION ===
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

# === STEP 1: Upload Image to Blob Storage ===
def upload_to_blob(file_path, container_name, connection_string):
    try:
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
        return f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{file_name}?{sas_token}", True
    except Exception as e:
        print(f"Error uploading to blob storage: {e}")
        return None, False

# === STEP 2: Extract OCR Text ===
def extract_ocr_text(blob_url, endpoint, key):
    client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    poller = client.begin_analyze_document_from_url("prebuilt-read", document_url=blob_url)
    result = poller.result()
    return "\n".join([line.content for page in result.pages for line in page.lines])

# === STEP 3: Determine Document Type ===
def determine_document_type(full_text, file_path):
    """Determine document type based on OCR text content or file path"""
    text_lower = full_text.lower()
    file_name = os.path.basename(file_path).lower()
    
    # Check file path for hints if OCR text is ambiguous
    if 'passport' in file_name:
        return "passport"
    elif 'dl' in file_name or 'driving' in file_name or 'license' in file_name:
        return "driving_license"
    elif 'id' in file_name or 'identity' in file_name:
        return "identity_card"
    
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

# === STEP 4: Extract Structured Fields Based on Document Type ===
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
    print(f"\n--- Structured Data from GPT ({doc_type}) ---")
    print(gpt_response)
    
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

# === STEP 5: Load Database and Verify Data ===
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
    
    # Debug: Print available passport numbers in database
    print(f"\n--- DEBUG: Looking for passport number: {passport_no} ---")
    print("Available passport numbers in database:")
    db_passport_numbers = passport_df['Passport No.'].astype(str).str.strip().tolist()
    for i, num in enumerate(db_passport_numbers[:5]):  # Show first 5 for debugging
        print(f"  {i+1}: '{num}' (type: {type(passport_df['Passport No.'].iloc[i])})")
    
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
        return "INVALID", f"Passport number {passport_no} not found in database. Available numbers: {db_passport_numbers[:3]}..."
    
    record = matching_records.iloc[0]
    print(f"--- Found matching record for passport {passport_no} ---")
    print(f"Database record: {record['Given Name']} {record['Surname']}")
    
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
    
    # Debug: Print available DLN numbers in database
    print(f"\n--- DEBUG: Looking for DLN number: {dln_no} ---")
    
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
    
    if dln_column:
        print(f"Using DLN column: '{dln_column}'")
        print("Available DLN numbers in database:")
        db_dln_numbers = dl_df[dln_column].astype(str).str.strip().tolist()
        for i, num in enumerate(db_dln_numbers[:5]):  # Show first 5 for debugging
            print(f"  {i+1}: '{num}'")
    else:
        print(f"Available columns in DL data: {dl_df.columns.tolist()}")
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
        return "INVALID", f"DLN number {dln_no} not found in database. Available numbers: {db_dln_numbers[:3]}..."
    
    record = matching_records.iloc[0]
    print(f"--- Found matching record for DLN {dln_no} ---")
    print(f"Database record: {record['Given Name']} {record['Surname']}")
    
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
    
    # Debug: Print available ID numbers in database
    print(f"\n--- DEBUG: Looking for ID number: {id_no} ---")
    
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
    
    if id_column:
        print(f"Using ID column: '{id_column}'")
        print("Available ID numbers in database:")
        db_id_numbers = id_df[id_column].astype(str).str.strip().tolist()
        for i, num in enumerate(db_id_numbers[:5]):  # Show first 5 for debugging
            print(f"  {i+1}: '{num}'")
    else:
        print(f"Available columns in ID data: {id_df.columns.tolist()}")
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
        return "INVALID", f"ID number {id_no} not found in database. Available numbers: {db_id_numbers[:3]}..."
    
    record = matching_records.iloc[0]
    print(f"--- Found matching record for ID {id_no} ---")
    print(f"Database record: {record['Given Name']} {record['Surname']}")
    
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

# === STEP 6: Display All Extracted Fields ===
def display_results(data, doc_type, verification_status, verification_message):
    print(f"\nExtracted Document Details ({doc_type.upper()}):")
    print(tabulate([[k, v] for k, v in data.items()], headers=["Field", "Value"], tablefmt="grid"))
    print(f"\nVerification Status: {verification_status}")
    if verification_message:
        print(f"Verification Details: {verification_message}")

# === STEP 7: Create/Save to Excel with Specific Column Names ===
def create_excel_with_headers(file_name):
    """Create new Excel file with specified column headers"""
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
        "Verification Status",
        "Documents Uploaded",
        "KYC Completed"
    ]
    
    # Create empty DataFrame with specified columns
    df = pd.DataFrame(columns=columns)
    
    # Save to Excel with headers
    df.to_excel(file_name, index=False)
    print(f"✅ Created new Excel file '{file_name}' with specified column headers")
    
    return df

def save_to_excel(data, doc_type, verification_status, verification_message, file_name, documents_uploaded):
    """Save extracted data to Excel file with DD/MM/YYYY date format"""
    
    # Check if file exists, if not create it with headers
    if not os.path.exists(file_name):
        print(f"File '{file_name}' does not exist. Creating new file with headers...")
        create_excel_with_headers(file_name)
    
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
    
    # Determine KYC Completed status
    kyc_completed = "NO"
    if documents_uploaded == "YES" and verification_status == "VALID":
        kyc_completed = "YES"
    
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
        "Verification Status": verification_status,
        "Documents Uploaded": documents_uploaded,
        "KYC Completed": kyc_completed
    }
    
    # Create DataFrame with the new record
    new_df = pd.DataFrame([record])
    
    try:
        # Read existing file
        existing_df = pd.read_excel(file_name)
        
        # Check if we should update an existing record or add a new one
        if doc_type == "passport" and record["Passport Number"] != "-":
            # Find existing record with same passport number
            mask = existing_df["Passport Number"] == record["Passport Number"]
        elif doc_type == "driving_license" and record["Driving License Number"] != "-":
            # Find existing record with same DL number
            mask = existing_df["Driving License Number"] == record["Driving License Number"]
        elif doc_type == "identity_card" and record["Identity Card Number"] != "-":
            # Find existing record with same ID number
            mask = existing_df["Identity Card Number"] == record["Identity Card Number"]
        else:
            mask = None
        
        if mask is not None and mask.any():
            # Update existing record
            existing_df.loc[mask, list(record.keys())] = list(record.values())
            updated_df = existing_df
            print("✅ Updated existing record in Excel file")
        else:
            # Append new record
            updated_df = pd.concat([existing_df, new_df], ignore_index=True)
            print("✅ Added new record to Excel file")
        
        # Save updated DataFrame
        updated_df.to_excel(file_name, index=False)
        
        print(f"📊 Total records in file: {len(updated_df)}")
        
    except Exception as e:
        print(f"⚠️ Error appending to existing Excel file: {e}")
        # If there's an error, just save the new record with headers
        new_df.to_excel(file_name, index=False)
        print(f"✅ Created new file with current record: {file_name}")

# === PROCESS SINGLE DOCUMENT ===
def process_document(file_path, database_sheets, excel_file="extracted_passport_details.xlsx"):
    """Process a single document and update the Excel file"""
    try:
        # Upload document to blob storage
        print(f"\nProcessing document: {os.path.basename(file_path)}")
        blob_url, upload_success = upload_to_blob(file_path, container_name, connection_string)
        documents_uploaded = "YES" if upload_success else "NO"
        
        if not upload_success:
            print("❌ Failed to upload document to blob storage")
            # Save record with failed upload status
            save_to_excel({}, "", "INVALID", "Document upload failed", excel_file, documents_uploaded)
            return False, "Document upload failed"
        
        # Extract OCR text
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        
        print("\n--- OCR Text ---")
        print(ocr_text)
        
        # Determine document type
        doc_type = determine_document_type(ocr_text, file_path)
        print(f"\n--- Detected Document Type: {doc_type.upper()} ---")
        
        # Extract structured data based on document type
        structured_data = extract_structured_fields(ocr_text, openai_client, deployment_name, doc_type)
        
        # Verify extracted data against database
        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        # Display results
        display_results(structured_data, doc_type, verification_status, verification_message)
        
        # Save to Excel with verification results and DD/MM/YYYY date format
        save_to_excel(structured_data, doc_type, verification_status, verification_message, excel_file, documents_uploaded)
        
        return verification_status == "VALID", verification_message
    
    except Exception as e:
        print(f"❌ Error processing document: {e}")
        # Save error record if possible
        save_to_excel({}, "", "ERROR", str(e), excel_file, "NO")
        return False, str(e)
# === MAIN ===
def main():
    try:
        # Load database sheets
        print("Loading database...")
        database_sheets = load_database_sheets()
        if not database_sheets:
            print("❌ Failed to load database. Exiting.")
            return
        
        # Process all three documents
        documents = [
            ("Passport", passport_path),
            ("Driving License", dl_path),
            ("Identity Card", id_path)
        ]
        
        success_count = 0
        for doc_name, doc_path in documents:
            if os.path.exists(doc_path):
                print(f"\n{'='*40}")
                print(f"PROCESSING {doc_name.upper()}")
                print(f"{'='*40}")
                if process_document(doc_path, database_sheets):
                    success_count += 1
            else:
                print(f"\n❌ {doc_name} document not found at path: {doc_path}")
                # Save record for missing document
                save_to_excel(
                    {}, 
                    doc_name.lower().replace(" ", "_"), 
                    "INVALID", 
                    f"Document not found at path: {doc_path}", 
                    "extracted_passport_details.xlsx", 
                    "NO"
                )
        
        print(f"\nProcessing complete. Successfully processed {success_count} of {len(documents)} documents.")
        
    except Exception as e:
        print(f"❌ Main process error: {e}")
@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        if 'passport' not in request.files and 'license' not in request.files and 'id_card' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400

        results = {}
        database_sheets = load_database_sheets()
        validation_status = True
        validation_messages = []
        
        # Process passport if uploaded
        if 'passport' in request.files:
            passport_file = request.files['passport']
            if passport_file.filename != '' and allowed_file(passport_file.filename):
                filename = f"passport_{uuid.uuid4().hex}.{passport_file.filename.rsplit('.', 1)[1].lower()}"
                temp_path = os.path.join(os.getcwd(), filename)
                passport_file.save(temp_path)
                
                success, verification_message = process_document(temp_path, database_sheets)
                if success:
                    passport_status = "VALID"
                else:
                    passport_status = "INVALID"
                    validation_status = False
                    validation_messages.append(f"Passport: {verification_message}")
                
                results['passport'] = {
                    'status': passport_status,
                    'message': verification_message
                }
                os.remove(temp_path)
        
        # Process driving license if uploaded
        if 'license' in request.files:
            license_file = request.files['license']
            if license_file.filename != '' and allowed_file(license_file.filename):
                filename = f"license_{uuid.uuid4().hex}.{license_file.filename.rsplit('.', 1)[1].lower()}"
                temp_path = os.path.join(os.getcwd(), filename)
                license_file.save(temp_path)
                
                success, verification_message = process_document(temp_path, database_sheets)
                if success:
                    license_status = "VALID"
                else:
                    license_status = "INVALID"
                    validation_status = False
                    validation_messages.append(f"Driving License: {verification_message}")
                
                results['license'] = {
                    'status': license_status,
                    'message': verification_message
                }
                os.remove(temp_path)
        
        # Process ID card if uploaded
        if 'id_card' in request.files:
            id_card_file = request.files['id_card']
            if id_card_file.filename != '' and allowed_file(id_card_file.filename):
                filename = f"id_{uuid.uuid4().hex}.{id_card_file.filename.rsplit('.', 1)[1].lower()}"
                temp_path = os.path.join(os.getcwd(), filename)
                id_card_file.save(temp_path)
                
                success, verification_message = process_document(temp_path, database_sheets)
                if success:
                    id_status = "VALID"
                else:
                    id_status = "INVALID"
                    validation_status = False
                    validation_messages.append(f"ID Card: {verification_message}")
                
                results['id_card'] = {
                    'status': id_status,
                    'message': verification_message
                }
                os.remove(temp_path)
        
        # Add overall validation status
        results['overall_validation'] = {
            'status': 'VALID' if validation_status else 'INVALID',
            'messages': validation_messages if not validation_status else ["All documents are valid"]
        }
        
        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
if __name__ == "__main__":
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)