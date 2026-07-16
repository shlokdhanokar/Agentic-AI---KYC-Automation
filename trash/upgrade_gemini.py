with open('requirements.txt', 'r', encoding='utf-8') as f:
    reqs = f.read()
reqs = reqs.replace('google-generativeai', 'google-genai')
with open('requirements.txt', 'w', encoding='utf-8') as f:
    f.write(reqs)

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix import
content = content.replace('import google.generativeai as genai', 'from google import genai\nfrom google.genai import types')

# Remove genai.configure
content = content.replace('    genai.configure(api_key=gemini_api_key)\n', '')

# Update model generation
target_generation = """    # Using Gemini
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Prepend the system instructions to the prompt
    full_prompt = "You extract structured document data from OCR text. Always format dates as DD/MM/YYYY.\\n\\n" + prompt
    
    try:
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.2)
        )"""

replacement_generation = """    # Using Gemini
    client = genai.Client(api_key=gemini_api_key)
    
    # Prepend the system instructions to the prompt
    full_prompt = "You extract structured document data from OCR text. Always format dates as DD/MM/YYYY.\\n\\n" + prompt
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=full_prompt,
            config=types.GenerateContentConfig(temperature=0.2)
        )"""

content = content.replace(target_generation, replacement_generation)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
