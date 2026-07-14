#!/bin/bash
# Start Celery in the background using 'solo' pool to prevent it from spawning multiple Python processes
celery -A app.celery worker --pool=solo --loglevel=info &

# Start Flask web server
python app.py
