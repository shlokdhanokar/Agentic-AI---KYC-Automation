import os
import json
import redis
from dotenv import load_dotenv

load_dotenv()

redis_url = os.environ.get("REDIS_URL")
if not redis_url:
    raise ValueError("REDIS_URL environment variable is missing")

# Initialize Redis client
# We use decode_responses=True so we get strings back instead of bytes
redis_client = redis.Redis.from_url(redis_url, decode_responses=True)

def save_document_status(document_id, status_data):
    """Save the document processing status to Redis."""
    redis_client.set(f"doc:{document_id}", json.dumps(status_data))

def get_document_status(document_id):
    """Retrieve the document processing status from Redis."""
    data = redis_client.get(f"doc:{document_id}")
    if data:
        return json.loads(data)
    return None

def add_log_to_document(document_id, log_entry):
    """Atomically append a log to the document's log array in Redis."""
    status_data = get_document_status(document_id)
    if not status_data:
        status_data = {'status': 'processing', 'logs': []}
    
    if 'logs' not in status_data:
        status_data['logs'] = []
        
    status_data['logs'].append(log_entry)
    save_document_status(document_id, status_data)

def save_final_record(document_id, record_data):
    """Save the final extracted and verified record to a global list."""
    redis_client.hset("all_records", document_id, json.dumps(record_data))

def get_all_records():
    """Get all processed records for the dashboard."""
    records = redis_client.hgetall("all_records")
    result = []
    for doc_id, val in records.items():
        record = json.loads(val)
        record['id'] = doc_id
        result.append(record)
    return result

def get_alerts():
    """Get all records that failed verification for the alerts page."""
    records = get_all_records()
    alerts = []
    from datetime import datetime
    for alert in records:
        if alert.get('Verification Status') == 'INVALID':
            alerts.append({
                'type': 'Verification Failed',
                'message': f"Document verification failed for {alert.get('Given Name', '')} {alert.get('Surname', '')}",
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'), # Using current time for demo since we don't store timestamp in record yet
                'severity': 'High',
                'document_type': 'Passport' if alert.get('Passport Number', '-') != '-' else 
                                'Driving License' if alert.get('Driving License Number', '-') != '-' else 
                                'Identity Card'
            })
    return alerts
