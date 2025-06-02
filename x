PS C:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\Projects\kyc_langchain_project> & "C:/Users/shlok.dhanokar/OneDrive - Coforge Limited/Desktop/Projects/kyc_langchain_project/.venv/Scripts/python.exe" "c:/Users/shlok.dhanokar/OneDrive - Coforge Limited/Desktop/Projects/kyc_langchain_project/test.py"
=== DOCUMENT VERIFICATION SYSTEM ===

1. Loading database sheets...
Loaded PASSPORT_DATA with 5 records
Loaded DL_DATA with 5 records
Loaded ID_DATA with 5 records

2. Uploading document to blob storage...
AARON ID.png uploaded to container 'kyc-image'.
c:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\Projects\kyc_langchain_project\test.py:52: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
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
```json
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
```

5. Determining document type...

6. Verifying against database...

7. Displaying results...

=== DOCUMENT TYPE: IDENTITY_CARD ===

Extracted Document Details:
+--------------------------+----------------+
| Field                    | Value          |
+==========================+================+
| "Passport Number"        | "-",           |
+--------------------------+----------------+
| "Driving License Number" | "8865638826",  |
+--------------------------+----------------+
| "Identity Card Number"   | "-",           |
+--------------------------+----------------+
+--------------------------+----------------+
| "Given Name"             | "AARON",       |
+--------------------------+----------------+
| "Date of Birth"          | "24 Nov 1987", |
+--------------------------+----------------+
| "Place of Birth"         | "-",           |
+--------------------------+----------------+
| "Date of Expiration"     | "22 Jun 2026", |
| Driving License Number   | -              |
+--------------------------+----------------+
| Identity Card Number     | 8865638826     |
+--------------------------+----------------+

=== VERIFICATION RESULT ===
Status: VALID
Details: Match found with 100.0% accuracy

Matched Fields:
  ✓ Identity Card Number: 8865638826

8. Saving results...

✅ Results saved to extracted_passport_details.xlsx

🎉 Processing completed successfully!
