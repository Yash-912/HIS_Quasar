# Voice Agent Module
# AI Voice Receptionist for Hospital Information System

## Overview
This module provides an AI-powered voice receptionist that integrates with the existing HIS backend.
It consumes the existing REST APIs as a new client, equivalent to the Web UI or Mobile App.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Run the service
uvicorn app.main:app --reload --port 5003
```

## Architecture

```
voice-agent/
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Configuration
│   ├── speech/                 # Speech Layer (STT/TTS)
│   ├── conversation/           # LLM Intent & Entity
│   ├── orchestration/          # Workflow Engine
│   ├── integration/            # HIS API Client
│   ├── models/                 # Pydantic schemas
│   └── logging/                # Audit & transcripts
├── tests/
├── requirements.txt
└── Dockerfile
```

## Endpoints

- `POST /voice/call` - Handle incoming voice call
- `POST /voice/transcribe` - Speech-to-text
- `POST /voice/synthesize` - Text-to-speech
- `POST /conversation/process` - Process user utterance
- `GET /health` - Health check

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| HIS_API_URL | Backend API URL | http://localhost:5001/api |
| HIS_API_USERNAME | Service account username | voice_agent |
| HIS_API_PASSWORD | Service account password | - |
| GOOGLE_APPLICATION_CREDENTIALS | Path to GCP credentials | - |
| LLM_PROVIDER | gemini, openai, or ollama | gemini |
| LOG_LEVEL | Logging level | INFO |
