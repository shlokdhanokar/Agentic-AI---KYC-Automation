# Use a lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy python requirements
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY app.py .
COPY database.py .
COPY start.sh .
COPY DATABASE_DOCUMENTS.xlsx .
COPY OFAC_SDN_LIST.csv .
COPY ["Philip DL.PNG", "."]

# Create uploads directory (used by the Flask app)
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 5000

# Set environment variables for production
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Run the startup script (starts both celery and flask)
RUN chmod +x start.sh
CMD ["./start.sh"]
