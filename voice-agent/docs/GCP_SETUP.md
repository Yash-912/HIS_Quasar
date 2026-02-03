# Google Cloud Speech Services Setup Guide

## Prerequisites
- Google Cloud account with billing enabled
- GCP Console access

## Step 1: Create or Select a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing: `his-voice-agent`

## Step 2: Enable Required APIs

Enable these APIs in your project:

1. **Cloud Speech-to-Text API**
   - Console: https://console.cloud.google.com/apis/library/speech.googleapis.com
   - Or via CLI: `gcloud services enable speech.googleapis.com`

2. **Cloud Text-to-Speech API**
   - Console: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
   - Or via CLI: `gcloud services enable texttospeech.googleapis.com`

## Step 3: Create Service Account

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"Create Service Account"**
3. Fill in:
   - **Name**: `voice-agent-sa`
   - **ID**: `voice-agent-sa` (auto-generated)
   - **Description**: `Service account for HIS Voice Agent STT/TTS`
4. Click **Create and Continue**

## Step 4: Assign Roles

Add these roles to the service account:
- `Cloud Speech-to-Text User` (roles/speech.user)
- `Cloud Text-to-Speech User` (roles/texttospeech.user)

## Step 5: Generate Credentials Key

1. Click on your service account
2. Go to **Keys** tab
3. Click **Add Key > Create new key**
4. Choose **JSON** format
5. A JSON file will download - save it as `gcp-credentials.json`

## Step 6: Configure Voice Agent

### Option A: Environment Variable (Recommended)

```bash
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\cocode\HIS_Quasar\voice-agent\gcp-credentials.json"

# Windows CMD
set GOOGLE_APPLICATION_CREDENTIALS=D:\cocode\HIS_Quasar\voice-agent\gcp-credentials.json

# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp-credentials.json"
```

### Option B: Update .env File

Add to `voice-agent/.env`:
```
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
```

## Step 7: Verify Setup

Run this Python script to verify:

```python
# test_gcp.py
from google.cloud import speech_v1
from google.cloud import texttospeech

# Test STT
speech_client = speech_v1.SpeechClient()
print("✅ Speech-to-Text client initialized")

# Test TTS
tts_client = texttospeech.TextToSpeechClient()
voices = tts_client.list_voices(language_code="en-IN")
print(f"✅ Text-to-Speech client initialized, found {len(voices.voices)} voices")
```

## Pricing Estimate

| Service | Free Tier | Standard Rate |
|---------|-----------|---------------|
| Speech-to-Text | 60 min/month | $0.006/15 sec |
| Text-to-Speech | 4 million chars/month | $4/1M chars |

For testing, the free tier is sufficient.

## Troubleshooting

### "Could not automatically determine credentials"
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set
- Check file path is correct
- Restart terminal/IDE after setting env var

### "Permission denied"
- Verify service account has correct roles
- Check API is enabled in project

### "API not enabled"
- Enable the specific API in GCP Console
- Wait 2-3 minutes for propagation

## Security Notes

⚠️ **Never commit `gcp-credentials.json` to git!**

Add to `.gitignore`:
```
gcp-credentials.json
*-credentials.json
```
