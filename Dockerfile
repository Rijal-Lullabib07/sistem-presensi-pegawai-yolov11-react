FROM python:3.10-slim

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server/ .

EXPOSE 5000

CMD ["gunicorn", "app:app", "--host", "0.0.0.0", "--port", "5000", "--timeout", "30", "--workers", "1"]
