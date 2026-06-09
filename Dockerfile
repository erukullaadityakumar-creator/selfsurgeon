# SelfSurgeon Backend Dockerfile
# For Google Cloud Run deployment

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p prompts data

# Expose port for Cloud Run
EXPOSE 8080

# Start FastAPI app using uvicorn
CMD ["uvicorn", "selfsurgeon-backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
