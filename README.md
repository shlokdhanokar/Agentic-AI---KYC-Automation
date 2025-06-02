curr.py update this code in such a way that it will create another column in the excel which is "Validity". the extracted text will be verified against a excel(DATABASE_DOCUMENTS.xlsx) that contains the details of all citizens of country , so if the extracted text is same as in the DATABASE_DOCUMENTS.xlsx , then it is valid, if not then it is invalid . DATABASE_DOCUMENTS.xlsx this file contains three pages containing PASSPORT_DATA , DL_DATA and ID_DATA . the extracted data in extracted_passport_details.xlsx should be validated with DATABASE_DOCUMENTS.xlsx , if they are correct then in the same excel "Valid" should be updated in the cell else invalid .
PS C:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\Projects\kyc_langchain_project> & "C:/Users/shlok.dhanokarPS C:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\ProjPS C:\Users\shlok.dhanokar\OneDrive - Coforge Limited\Desktop\Projects\kyc_langchain_project> & "C:/Users/shlok.dhanokar/OneDrive - Coforge Limited/Desktop/Projects/kyc_langchain_project/.venv/Scripts/python.exe" c:/Users/shlok.dhanokar/Downloads/updated_curr_py.py
📚 Loading validation database...
✅ Database loaded successfully:
   - Passport records: 5
   - Driving License records: 5
   - Identity Card records: 5
AARON ID.png uploaded to container 'kyc-image'.
c:\Users\shlok.dhanokar\Downloads\updated_curr_py.py:49: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  expiry=datetime.utcnow() + timedelta(hours=1)

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

--- Structured Data from GPT ---
{
  "Passport Number": "8865638826",
  "Surname": "WARNER",
  "Given Name": "AARON",
  "Date of Birth": "24 Nov 1987",
  "Place of Birth": "LAS VEGAS",
  "Date of Expiration": "22 Jun 2026",
  "Sex": "M"
}

Extracted Document Details:
+------------------------+-------------+
| Field                  | Value       |
+========================+=============+
| Passport Number        | -           |
+------------------------+-------------+
| Surname                | WARNER      |
+------------------------+-------------+
| Given Name             | AARON       |
+------------------------+-------------+
  "Place of Birth": "LAS VEGAS",
  "Date of Expiration": "22 Jun 2026",
  "Sex": "M"
}

Extracted Document Details:
+------------------------+-------------+
| Field                  | Value       |
+========================+=============+
| Passport Number        | -           |
+------------------------+-------------+
| Surname                | WARNER      |
+------------------------+-------------+
| Given Name             | AARON       |
+------------------------+-------------+
| Date of Birth          | 24 Nov 1987 |
  "Date of Expiration": "22 Jun 2026",
  "Sex": "M"
}

Extracted Document Details:
+------------------------+-------------+
| Field                  | Value       |
+========================+=============+
| Passport Number        | -           |
+------------------------+-------------+
| Surname                | WARNER      |
+------------------------+-------------+
| Given Name             | AARON       |
+------------------------+-------------+
| Date of Birth          | 24 Nov 1987 |
  "Date of Expiration": "22 Jun 2026",
  "Sex": "M"
}

Extracted Document Details:
+------------------------+-------------+
| Field                  | Value       |
+========================+=============+
| Passport Number        | -           |
+------------------------+-------------+
| Surname                | WARNER      |
+------------------------+-------------+
| Given Name             | AARON       |
+------------------------+-------------+
| Date of Birth          | 24 Nov 1987 |
  "Sex": "M"
}

Extracted Document Details:
+------------------------+-------------+       
| Field                  | Value       |       
+========================+=============+       
| Passport Number        | -           |       
+------------------------+-------------+       
| Surname                | WARNER      |       
+------------------------+-------------+       
| Given Name             | AARON       |       
+------------------------+-------------+
| Place of Birth         | LAS VEGAS   |
+------------------------+-------------+
| Date of Expiration     | 22 Jun 2026 |
+------------------------+-------------+
| Sex                    | M           |
+------------------------+-------------+
| Driving License Number | -           |
+------------------------+-------------+
| Identity Card Number   | 8865638826  |
+------------------------+-------------+

🔍 Validation Result: Invalid
✅ Data saved to extracted_passport_details.xlsx with validity status: Invalid

why is it showing invalid when the the details present in DATABASE_DOCUMENTS.xlsx is same as the texts extracted from the document . it should be valid .
