# Use official lightweight Python image
FROM python:3.12-slim

# Prevent Python from writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code (exclude secrets via .dockerignore)
COPY app ./app
COPY requirements.txt ./

# Create a non-root app user for security best practices.
# /app/workspaces must pre-exist with app ownership: named volumes seeded from
# the image inherit it; without this, the mountpoint lands root-owned and the
# API 500s on every workspace/studio file operation (Errno 13).
RUN addgroup --gid 10001 appgroup && \
    adduser --uid 10001 --ingroup appgroup --disabled-password --gecos "" appuser && \
    mkdir -p /app/workspaces && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Single async worker — handles thousands of concurrent WebSocket connections
# via the event loop. Multi-worker support requires a Redis Pub/Sub adapter
# in CallWSManager so that all workers share connection state.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
