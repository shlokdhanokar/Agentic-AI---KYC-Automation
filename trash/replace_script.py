with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        if structured_data:
            fields = ', '.join([k for k, v in structured_data.items() if v and v != '-'][:4])
            add_log(document_id, f'[Gemini AI] ✓ Fields extracted: {fields}...')"""

replacement = """        if structured_data:
            if "Error" in structured_data:
                add_log(document_id, f'[Gemini AI] ✗ API Error: {structured_data["Error"]}', error=True)
            else:
                fields = ', '.join([k for k, v in structured_data.items() if v and v != '-'][:4])
                add_log(document_id, f'[Gemini AI] ✓ Fields extracted: {fields}...')"""

content = content.replace(target, replacement)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
