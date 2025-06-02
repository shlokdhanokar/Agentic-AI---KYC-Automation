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

# === CONFIGURATION ===
connection_string = "DefaultEndpointsProtocol=https;AccountName=doctrainings;AccountKey=nOFJZry+p3BbM1C+fxP5YAJBNJj/Odebs8cgfbBwk9Nu83MSsqcDC9FLpY0yxJrHZn2JC/bEpOoE+AStz+fyLg==;EndpointSuffix=core.windows.net"
container_name = "kyc-image"

def normalize_path(path):
    return os.path.normpath(path)

file_path = normalize_path(r"C:\Users\shlok.dhanokar\Downloads\Document_Dataset\Document_Dataset\Sorted ID\AARON ID.png")
file_name = os.path.basename(file_path)
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

# === STEP 1: Upload Image to Blob Storage ===
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

# === STEP 2: Extract OCR Text ===
def extract_ocr_text(blob_url, endpoint, key):
    client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    poller = client.begin_analyze_document_from_url("prebuilt-read", document_url=blob_url)
    result = poller.result()
    return "\n".join([line.content for page in result.pages for line in page.lines])

# === STEP 3: Load Database Sheets ===
def load_database_sheets():
    """Load all sheets from the database Excel file"""
    try:
        sheets = {}
        excel_file = pd.ExcelFile(DATABASE_FILE)
        
        # Load PASSPORT_DATA sheet
        if 'PASSPORT_DATA' in excel_file.sheet_names:
            sheets['PASSPORT_DATA'] = pd.read_excel(DATABASE_FILE, sheet_name='PASSPORT_DATA')
            print(f"Loaded PASSPORT_DATA with {len(sheets['PASSPORT_DATA'])} records")
        
        # Load DL_DATA sheet
        if 'DL_DATA' in excel_file.sheet_names:
            sheets['DL_DATA'] = pd.read_excel(DATABASE_FILE, sheet_name='DL_DATA')
            print(f"Loaded DL_DATA with {len(sheets['DL_DATA'])} records")
        
        # Load ID_DATA sheet
        if 'ID_DATA' in excel_file.sheet_names:
            sheets['ID_DATA'] = pd.read_excel(DATABASE_FILE, sheet_name='ID_DATA')
            print(f"Loaded ID_DATA with {len(sheets['ID_DATA'])} records")
            
        return sheets
    except FileNotFoundError:
        print(f"Database file {DATABASE_FILE} not found!")
        return {}
    except Exception as e:
        print(f"Error loading database: {e}")
        return {}

# === STEP 4: Determine Document Type ===
def determine_document_type(full_text, extracted_data):
    """Determine document type based on extracted data and OCR text"""
    text_lower = full_text.lower()
    
    # Check for passport indicators
    passport_indicators = ['passport', 'republic', 'issued', 'authority', 'place of birth']
    passport_score = sum(1 for indicator in passport_indicators if indicator in text_lower)
    
    # Check for driving license indicators
    dl_indicators = ['driving', 'license', 'licence', 'driver', 'dl no', 'dln']
    dl_score = sum(1 for indicator in dl_indicators if indicator in text_lower)
    
    # Check for ID card indicators
    id_indicators = ['identity', 'card', 'id no', 'national', 'citizen']
    id_score = sum(1 for indicator in id_indicators if indicator in text_lower)
    
    # Also check based on number patterns and extracted data
    has_passport_num = extracted_data.get("Passport Number", "-") != "-"
    has_dl_num = extracted_data.get("Driving License Number", "-") != "-"
    has_id_num = extracted_data.get("Identity Card Number", "-") != "-"
    
    # Decision logic
    if passport_score >= 2 or has_passport_num:
        return "PASSPORT"
    elif dl_score >= 2 or has_dl_num:
        return "DRIVING_LICENSE"
    elif id_score >= 2 or has_id_num:
        return "IDENTITY_CARD"
    else:
        # Default based on highest score
        scores = {"PASSPORT": passport_score, "DRIVING_LICENSE": dl_score, "IDENTITY_CARD": id_score}
        return max(scores, key=scores.get)

# === STEP 5: Verify Against Database ===
def verify_against_database(extracted_data, document_type, database_sheets):
    """Verify extracted data against appropriate database sheet"""
    verification_result = {
        'status': 'INVALID',
        'matched_fields': [],
        'mismatched_fields': [],
        'details': ''
    }
    
    # Select appropriate sheet based on document type
    sheet_mapping = {
        'PASSPORT': 'PASSPORT_DATA',
        'DRIVING_LICENSE': 'DL_DATA', 
        'IDENTITY_CARD': 'ID_DATA'
    }
    
    sheet_name = sheet_mapping.get(document_type)
    if not sheet_name or sheet_name not in database_sheets:
        verification_result['details'] = f"No database sheet found for {document_type}"
        return verification_result
    
    df = database_sheets[sheet_name]
    
    # Normalize column names for comparison
    df.columns = df.columns.str.strip()
    
    # Define field mappings for each document type
    field_mappings = {
        'PASSPORT': {
            'Given Name': 'Given Name',
            'Surname': 'Surname', 
            'Date of Birth': 'Date of Birth',
            'Place of Birth': 'Place of Birth',
            'Sex': 'Sex',
            'Date of Expiration': 'Date of Expiry',
            'Passport Number': 'Passport No.'
        },
        'DRIVING_LICENSE': {
            'Given Name': 'Given Name',
            'Surname': 'Surname',
            'Date of Birth': 'Date of Birth', 
            'Sex': 'Sex',
            'Date of Expiration': 'Date of Expiry',
            'Driving License Number': 'DLN NO.'
        },
        'IDENTITY_CARD': {
            'Given Name': 'Given Name',
            'Surname': 'Surname',
            'Date of Birth': 'Date of Birth',
            'Sex': 'Sex', 
            'Date of Expiration': 'Date of Expiry',
            'Identity Card Number': 'ID NO.'
        }
    }
    
    mapping = field_mappings.get(document_type, {})
    
    # Find matching record
    best_match = None
    best_match_score = 0
    
    for index, row in df.iterrows():
        match_score = 0
        total_fields = 0
        
        for extracted_field, db_field in mapping.items():
            if db_field in df.columns and extracted_field in extracted_data:
                total_fields += 1
                extracted_value = str(extracted_data[extracted_field]).strip().upper()
                db_value = str(row[db_field]).strip().upper()
                
                if extracted_value == db_value and extracted_value != "-" and extracted_value != "NAN":
                    match_score += 1
        
        if total_fields > 0:
            match_percentage = match_score / total_fields
            if match_percentage > best_match_score:
                best_match_score = match_percentage
                best_match = row
    
    # Determine verification result
    if best_match is not None and best_match_score >= 0.7:  # 70% match threshold
        verification_result['status'] = 'VALID'
        verification_result['details'] = f"Match found with {best_match_score:.1%} accuracy"
        
        # Record matched and mismatched fields
        for extracted_field, db_field in mapping.items():
            if db_field in df.columns and extracted_field in extracted_data:
                extracted_value = str(extracted_data[extracted_field]).strip().upper()
                db_value = str(best_match[db_field]).strip().upper()
                
                if extracted_value == db_value and extracted_value != "-" and extracted_value != "NAN":
                    verification_result['matched_fields'].append(f"{extracted_field}: {extracted_value}")
                else:
                    verification_result['mismatched_fields'].append(
                        f"{extracted_field}: Extracted='{extracted_data[extracted_field]}' vs DB='{best_match[db_field]}'"
                    )
    else:
        verification_result['status'] = 'INVALID'
        verification_result['details'] = f"No sufficient match found. Best match: {best_match_score:.1%}" if best_match is not None else "No match found"
    
    return verification_result

# === STEP 6: Extract Structured Fields and Classify Document ===
def extract_structured_fields(full_text, openai_client, deployment_name):
    prompt = f"""
You are an assistant that extracts structured document information from OCR text.
Extract the following fields if available:
- Passport Number
- Driving License Number  
- Identity Card Number
- Surname
- Given Name
- Date of Birth
- Place of Birth
- Date of Expiration
- Sex

Instructions:
- Don't use quotes for every cell
- Date of Birth should be in "02 Jul 1977" format
- If only a full name is provided, split the last word as surname
- If a field is not explicitly labeled, infer it from context
- Return only fields that are actually present in the document
- Use "-" for fields that are not found

Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""
    response = openai_client.chat.completions.create(
        model=deployment_name,
        messages=[
            {"role": "system", "content": "You extract structured document data from OCR text."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )
    gpt_response = response.choices[0].message.content
    print("\n--- Structured Data from GPT ---")
    print(gpt_response)
    
    try:
        extracted_data = json.loads(gpt_response)
    except json.JSONDecodeError:
        extracted_data = {}
        for line in gpt_response.splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                extracted_data[key.strip()] = value.strip()

    # === Enhanced Document Number Classification ===
    numbers = re.findall(r'\b\d{7,12}\b', full_text)
    
    # Initialize with defaults
    extracted_data.setdefault("Passport Number", "-")
    extracted_data.setdefault("Driving License Number", "-") 
    extracted_data.setdefault("Identity Card Number", "-")
    
    # Classify numbers based on length and context
    for num in numbers:
        if len(num) == 9 and extracted_data["Passport Number"] == "-":
            extracted_data["Passport Number"] = num
        elif len(num) == 7 and extracted_data["Driving License Number"] == "-":
            extracted_data["Driving License Number"] = num
        elif len(num) >= 10 and extracted_data["Identity Card Number"] == "-":
            extracted_data["Identity Card Number"] = num

    return extracted_data

# === STEP 7: Display Results ===
def display_results(data, document_type, verification_result):
    print(f"\n=== DOCUMENT TYPE: {document_type} ===")
    print("\nExtracted Document Details:")
    print(tabulate([[k, v] for k, v in data.items()], headers=["Field", "Value"], tablefmt="grid"))
    
    print(f"\n=== VERIFICATION RESULT ===")
    print(f"Status: {verification_result['status']}")
    print(f"Details: {verification_result['details']}")
    
    if verification_result['matched_fields']:
        print("\nMatched Fields:")
        for field in verification_result['matched_fields']:
            print(f"  ✓ {field}")
    
    if verification_result['mismatched_fields']:
        print("\nMismatched Fields:")
        for field in verification_result['mismatched_fields']:
            print(f"  ✗ {field}")

# === STEP 8: Save to Excel with Verification ===
def save_to_excel(data, document_type, verification_result, file_name):
    # Prepare row data with verification
    row_data = {
        "Document Type": document_type,
        "Passport Number": data.get("Passport Number", "-"),
        "Driving License Number": data.get("Driving License Number", "-"), 
        "Identity Card Number": data.get("Identity Card Number", "-"),
        "Given Name": data.get("Given Name", "-"),
        "Surname": data.get("Surname", "-"),
        "Date of Birth": data.get("Date of Birth", "-"),
        "Place of Birth": data.get("Place of Birth", "-"),
        "Date of Expiration": data.get("Date of Expiration", "-"),
        "Sex": data.get("Sex", "-"),
        "Verification Status": verification_result['status'],
        "Verification Details": verification_result['details'],
        "Processing Date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    df = pd.DataFrame([row_data])
    
    if os.path.exists(file_name):
        try:
            with pd.ExcelWriter(file_name, engine='openpyxl', mode='a', if_sheet_exists='overlay') as writer:
                existing_df = pd.read_excel(file_name)
                updated_df = pd.concat([existing_df, df], ignore_index=True)
                updated_df.to_excel(writer, index=False, sheet_name='Sheet1')
        except Exception as e:
            print(f"⚠️ Error appending to existing Excel file: {e}. Creating a new one.")
            df.to_excel(file_name, index=False)
    else:
        df.to_excel(file_name, index=False)
    
    print(f"\n✅ Results saved to {file_name}")

# === MAIN FUNCTION ===
def main():
    try:
        print("=== DOCUMENT VERIFICATION SYSTEM ===")
        
        # Load database sheets
        print("\n1. Loading database sheets...")
        database_sheets = load_database_sheets()
        if not database_sheets:
            print("❌ Could not load database. Proceeding without verification.")
        
        # Upload and process document
        print("\n2. Uploading document to blob storage...")
        blob_url = upload_to_blob(file_path, container_name, connection_string)
        
        print("\n3. Extracting OCR text...")
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        print("\n--- OCR Text ---")
        print(ocr_text)
        
        print("\n4. Extracting structured data...")
        structured_data = extract_structured_fields(ocr_text, openai_client, deployment_name)
        
        print("\n5. Determining document type...")
        document_type = determine_document_type(ocr_text, structured_data)
        
        print("\n6. Verifying against database...")
        verification_result = verify_against_database(structured_data, document_type, database_sheets)
        
        print("\n7. Displaying results...")
        display_results(structured_data, document_type, verification_result)
        
        print("\n8. Saving results...")
        save_to_excel(structured_data, document_type, verification_result, "extracted_passport_details.xlsx")
        
        print("\n🎉 Processing completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Please check your credentials and configuration.")

if __name__ == "__main__":
    main()