#!/bin/bash
# Start Celery in the background
celery -A app.celery worker --loglevel=info &
# Start Flask web server
python app.py
