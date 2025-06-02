PS C:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\Projec> & "C:/Users/shlok.dhanokar/OneDrive - Coforge Limited/Desktop/Projects/kyc_langchain_project/.venv/Scripts/python.exe" "c:/Users/shlok.dhanokar/Downloads/document_verification_system (1).py"
=== DOCUMENT VERIFICATION SYSTEM ===

1. Loading database sheets...
Loaded PASSPORT_DATA with 5 records
Loaded DL_DATA with 5 records
Loaded ID_DATA with 5 records

2. Uploading document to blob storage...
AARON ID.png uploaded to container 'kyc-image'.
c:\Users\shlok.dhanokar\Downloads\document_verification_system (1).py:52: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  expiry=datetime.utcnow() + timedelta(hours=1)

3. Extracting OCR text...

--- OCR Text ---
NEVADAS
IDENTIFICATION CARD
Trmice
4d ID NO. 8865638826
3 DOB 24/11/1987
1 AARON
2 WARNER
8 203 FLAMINGO ROAD
LAS VEGAS, NV 89101
NEVADA
4b EXP
06/22/2026
4a ISS
06/22/2021
15 SEX M
16 HGT 5-07
17 WGT 248 lb
18 EYES BRO
19 HAIR BRO
5 DD 000000000000000002632

4. Extracting structured data...

--- Structured Data from GPT ---
{
  "Passport Number": "-",
  "Driving License Number": "8865638826",
  "Identity Card Number": "-",
  "Surname": "WARNER",
  "Given Name": "AARON",
  "Date of Birth": "24 Nov 1987",
  "Place of Birth": "-",
  "Date of Expiration": "22 Jun 2026",
  "Sex": "M"
}

5. Determining document type...

6. Verifying against database...

7. Displaying results...

=== DOCUMENT TYPE: DRIVING_LICENSE ===

Extracted Document Details:
+------------------------+-------------+
| Field                  | Value       |
+========================+=============+
| Passport Number        | -           |
+------------------------+-------------+
| Driving License Number | 8865638826  |
+------------------------+-------------+
| Identity Card Number   | 8865638826  |
+------------------------+-------------+
| Surname                | WARNER      |
+------------------------+-------------+
| Given Name             | AARON       |
+------------------------+-------------+
| Date of Birth          | 24 Nov 1987 |
+------------------------+-------------+
| Place of Birth         | -           |
+------------------------+-------------+
| Date of Expiration     | 22 Jun 2026 |
+------------------------+-------------+
| Sex                    | M           |
+------------------------+-------------+

=== VERIFICATION RESULT ===
Status: VALID
Details: Match found with 66.7% accuracy

Matched Fields:
  ✓ Given Name: AARON
  ✓ Surname: WARNER
  ✓ Date of Birth: 24 Nov 1987
  ✓ Sex: M

Mismatched Fields:
  ✗ Date of Expiration: Extracted='22 Jun 2026' vs DB='05/01/2026'
  ✗ Driving License Number: Extracted='8865638826' vs DB='7536978'

8. Saving results...

✅ Results saved to extracted_passport_details.xlsx

--- Data Saved to Excel ---
Document Type: DRIVING_LICENSE
Driving License Number: 8865638826
Matched Fields: Given Name: AARON; Surname: WARNER; Date of Birth: 24 Nov 1987; Sex: M
Matched Fields: Given Name: AARON; Surname: WARNER; Date of Birth: 24 Nov 1987; Sex: M
Mismatched Fields: Date of Expiration: Extracted='22 Jun 2026' vs DB='05/01/2026'; Driving License Number: Extracted='8865638826' vs DB='7536978'
Processing Date: 2025-06-02 13:44:45

🎉 Processing completed successfully!
