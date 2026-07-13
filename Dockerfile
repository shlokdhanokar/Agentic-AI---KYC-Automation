# Stage 1: Build the React frontend
FROM node:20-alpine as build-stage

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
# Use npm install with --legacy-peer-deps or --force if needed, though standard should work.
RUN npm install

# Copy the rest of the frontend source code (src and public directories)
COPY src/ ./src/
COPY public/ ./public/

# Build the frontend
RUN npm run build

# Stage 2: Build the Python backend and serve
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies if required (e.g., for pandas/openpyxl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy python requirements
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files (app.py, Excel files, etc.)
# We only copy the necessary files to avoid pulling in frontend source code
COPY app.py .
COPY DATABASE_DOCUMENTS.xlsx .
COPY *.py ./
COPY ["Philip DL.PNG", "."]

# Create uploads directory (used by the Flask app)
RUN mkdir -p uploads

# Copy the built React app from the previous stage into the 'build' directory
COPY --from=build-stage /app/build ./build

# Expose the port the app runs on
EXPOSE 5000

# Set environment variables for production
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Command to run the application using Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
