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

# === CONFIGURATION ===
connection_string = "DefaultEndpointsProtocol=https;AccountName=doctrainings;AccountKey=nOFJZry+p3BbM1C+fxP5YAJBNJj/Odebs8cgfbBwk9Nu83MSsqcDC9FLpY0yxJrHZn2JC/bEpOoE+AStz+fyLg==;EndpointSuffix=core.windows.net"
container_name = "kyc-image"
file_path = "C:\\Users\\shlok.dhanokar\\Downloads\\Document_Dataset\\Document_Dataset\\Sorted Passport\\Lynn.png"


file_name = os.path.basename(file_path)

form_recognizer_endpoint = "https://mypoc.cognitiveservices.azure.com/"
form_recognizer_key = "d499d3bcebba45058b02c228e0ef3cf4"

openai_client = AzureOpenAI(
    api_key="Ff0YRHqouo7vFCicY6PNtP1mgr4wtwkc3fsvfdG7LU7cRU9b7rIkJQQJ99BEACYeBjFXJ3w3AAABACOGIM6j",
    api_version="2024-02-01",
    azure_endpoint="https://azuresearchopenapi.openai.azure.com/"
)
deployment_name = "gpt-4o-mini"

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

# === STEP 3: Extract Structured Fields ===
def extract_structured_fields(full_text, openai_client, deployment_name):
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

If only a full name is provided, split the last word as surname.
If a field is not explicitly labeled, infer it from context (e.g., "COSTA RICA" is likely a place of birth).
Return the result as a JSON object with keys exactly as listed above.

OCR Text:
{full_text}
"""

    response = openai_client.chat.completions.create(
        model=deployment_name,
        messages=[
            {"role": "system", "content": "You extract structured passport data from OCR text."},
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

    return extracted_data

# === STEP 4: Display Results ===
def display_results(data):
    print("\nExtracted Passport Details:")
    print(tabulate([[k, v] for k, v in data.items()], headers=["Field", "Value"], tablefmt="grid"))

# === STEP 5: Save to Excel ===
def save_to_excel(data, file_name):
    df = pd.DataFrame([data])
    if os.path.exists(file_name):
        try:
            with pd.ExcelWriter(file_name, engine='openpyxl', mode='a', if_sheet_exists='overlay') as writer:
                sheet = writer.sheets.get('Sheet1')
                start_row = sheet.max_row if sheet else 0
                df.to_excel(writer, index=False, header=False, startrow=start_row)
        except Exception as e:
            print(f"⚠️ Error appending to existing Excel file: {e}. Creating a new one.")
            df.to_excel(file_name, index=False)
    else:
        df.to_excel(file_name, index=False)

# === MAIN ===
def main():
    try:
        blob_url = upload_to_blob(file_path, container_name, connection_string)
        ocr_text = extract_ocr_text(blob_url, form_recognizer_endpoint, form_recognizer_key)
        structured_data = extract_structured_fields(ocr_text, openai_client, deployment_name)
        display_results(structured_data)
        save_to_excel(structured_data, "extracted_passport_details.xlsx")
    except Exception as e:
        print(f"Error: {e}")
        print("Please check your credentials and configuration.")

if __name__ == "__main__":
    main()
