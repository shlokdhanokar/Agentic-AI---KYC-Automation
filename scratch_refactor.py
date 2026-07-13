import re

def refactor():
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports and Celery setup
    content = re.sub(
        r"import google\.generativeai as genai\nfrom dotenv import load_dotenv\nimport pandas as pd\nimport re",
        "import google.generativeai as genai\nfrom dotenv import load_dotenv\nimport pandas as pd\nimport re\nfrom celery import Celery\nimport database",
        content
    )

    content = re.sub(
        r"app = Flask\(__name__, static_folder='build/static', static_url_path='/static'\)\nCORS\(app\)  # Enable CORS for all routes\n\n# === CONFIGURATION ===",
        "app = Flask(__name__, static_folder='build/static', static_url_path='/static')\nCORS(app)  # Enable CORS for all routes\n\ndef make_celery(app_name=__name__):\n    redis_url = os.environ.get('REDIS_URL')\n    if not redis_url:\n        raise ValueError('REDIS_URL is not set')\n    return Celery(app_name, backend=redis_url, broker=redis_url)\ncelery = make_celery()\n\n# === CONFIGURATION ===",
        content
    )

    # 2. Remove STATUS_FILE
    content = re.sub(
        r"STATUS_FILE = \"extracted_passport_details\.xlsx\"\n\n# In-memory storage for document status \(in production, use a database\)\ndocument_status = \{\}",
        "",
        content
    )

    # 3. Replace save_to_excel usage
    content = re.sub(
        r"def save_to_excel\(data, doc_type, verification_status, verification_message, file_name\):[\s\S]*?def get_verification_status",
        "def get_verification_status",
        content
    )
    
    # 4. Remove get_verification_status since it's now in database
    content = re.sub(
        r"def get_verification_status\(document_id\):[\s\S]*?# === API ENDPOINTS ===",
        "# === API ENDPOINTS ===",
        content
    )

    # 5. Refactor /upload
    upload_replacement = """        # Initialize document status
        database.save_document_status(document_id, {
            'status': 'uploading',
            'message': 'Document uploaded, processing...',
            'verification_status': None,
            'kyc_completed': False
        })
        
        # Process the file in the background
        process_document.delay(file_path, document_id)
        
        return jsonify({"""
    content = re.sub(
        r"        # Initialize document status\n        document_status\[document_id\] = \{\n            'status': 'uploading',\n            'message': 'Document uploaded, processing\.\.\.',\n            'verification_status': None,\n            'kyc_completed': False\n        \}\n        \n        # Process the file in the background\n        from threading import Thread\n        thread = Thread\(target=process_document, args=\(file_path, document_id\)\)\n        thread\.start\(\)\n        \n        return jsonify\(\{",
        upload_replacement,
        content
    )
    
    # 6. Refactor process_document
    # Since process_document is long, replace it entirely
    
    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor()
