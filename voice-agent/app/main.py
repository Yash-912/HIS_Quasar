"""
Voice Agent - FastAPI Main Application
AI Voice Receptionist for Hospital Information System
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.config import get_settings
from app.integration.his_client import HISClient
from app.speech.stt import SpeechToText
from app.speech.tts import TextToSpeech
from app.conversation.intent_classifier import IntentClassifier
from app.orchestration.workflow_engine import WorkflowEngine

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()
settings = get_settings()

# Global service instances
his_client: HISClient = None
stt: SpeechToText = None
tts: TextToSpeech = None
intent_classifier: IntentClassifier = None
workflow_engine: WorkflowEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    global his_client, stt, tts, intent_classifier, workflow_engine
    
    logger.info("Starting Voice Agent service", port=settings.voice_agent_port)
    
    # Initialize HIS client and authenticate
    his_client = HISClient(
        base_url=settings.his_api_url,
        username=settings.his_api_username,
        password=settings.his_api_password
    )
    await his_client.authenticate()
    logger.info("HIS client authenticated")
    
    # Initialize speech services
    stt = SpeechToText(language=settings.voice_language)
    tts = TextToSpeech(language=settings.voice_language, gender=settings.voice_gender)
    
    # Initialize conversation intelligence
    # Select API key based on provider
    if settings.llm_provider == "openrouter":
        llm_api_key = settings.openrouter_api_key
        llm_model = settings.openrouter_model
    elif settings.llm_provider == "gemini":
        llm_api_key = settings.gemini_api_key
        llm_model = None  # Use default
    else:
        llm_api_key = settings.openai_api_key
        llm_model = None  # Use default
    
    intent_classifier = IntentClassifier(
        provider=settings.llm_provider,
        api_key=llm_api_key,
        model=llm_model
    )
    
    # Initialize workflow engine
    workflow_engine = WorkflowEngine(his_client=his_client)
    
    logger.info("Voice Agent ready to accept calls")
    
    yield
    
    # Cleanup
    await his_client.close()
    logger.info("Voice Agent shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Voice Agent - HIS Voice Receptionist",
    description="AI-powered voice receptionist for Hospital Information System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files for web demo
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Get the web-demo directory path
web_demo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web-demo")
if os.path.exists(web_demo_path):
    app.mount("/demo", StaticFiles(directory=web_demo_path, html=True), name="demo")


# Redirect root to demo
@app.get("/ui")
async def redirect_to_demo():
    """Redirect to Web Demo UI."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/demo/index.html")


# =============================================================================
# Health & Info Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "voice-agent",
        "version": "1.0.0",
        "his_connected": his_client.is_authenticated if his_client else False
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Voice Agent - HIS Voice Receptionist",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "voice_call": "POST /voice/call",
            "transcribe": "POST /voice/transcribe",
            "synthesize": "POST /voice/synthesize",
            "conversation": "POST /conversation/process"
        }
    }


# =============================================================================
# Voice Endpoints
# =============================================================================

from app.models.requests import (
    VoiceCallRequest,
    TranscribeRequest,
    SynthesizeRequest,
    ConversationRequest
)
from app.models.responses import (
    VoiceCallResponse,
    TranscribeResponse,
    SynthesizeResponse,
    ConversationResponse
)


@app.post("/voice/call", response_model=VoiceCallResponse)
async def handle_voice_call(request: VoiceCallRequest):
    """
    Handle incoming voice call.
    This is the main entry point for voice interactions.
    """
    try:
        # Create new session
        session_id = workflow_engine.create_session(
            caller_id=request.caller_id,
            channel=request.channel
        )
        
        # Generate greeting
        greeting = await workflow_engine.generate_greeting()
        
        # Synthesize greeting (gracefully handle TTS failures)
        audio_response = ""
        try:
            audio_response = await tts.synthesize(greeting)
        except Exception as tts_err:
            logger.warning("TTS synthesis failed, continuing without audio", error=str(tts_err))
        
        logger.info("Voice call started", 
                   session_id=session_id, 
                   caller_id=request.caller_id)
        
        return VoiceCallResponse(
            session_id=session_id,
            response_text=greeting,
            audio_base64=audio_response,
            requires_input=True
        )
    except Exception as e:
        logger.error("Voice call failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Convert speech audio to text."""
    try:
        transcript = await stt.transcribe(
            audio_base64=request.audio_base64,
            sample_rate=request.sample_rate
        )
        
        logger.info("Audio transcribed", 
                   session_id=request.session_id,
                   transcript_length=len(transcript))
        
        return TranscribeResponse(
            session_id=request.session_id,
            transcript=transcript,
            confidence=0.95  # Placeholder - real STT returns this
        )
    except Exception as e:
        logger.error("Transcription failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice/synthesize", response_model=SynthesizeResponse)
async def synthesize_speech(request: SynthesizeRequest):
    """Convert text to speech audio."""
    try:
        audio_base64 = await tts.synthesize(
            text=request.text,
            speed=request.speed
        )
        
        return SynthesizeResponse(
            audio_base64=audio_base64,
            duration_seconds=len(request.text) * 0.06  # Rough estimate
        )
    except Exception as e:
        logger.error("Synthesis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/conversation/process", response_model=ConversationResponse)
async def process_conversation(request: ConversationRequest):
    """
    Process user utterance through the conversation pipeline.
    This is the main conversation handler with safety guardrails.
    """
    from app.conversation.safety import SafetyGuardrails, SafetyAction
    from app.conversation.validators import EntityValidator
    from app.conversation.retry_handler import RetryHandler, RETRY_CONFIGS
    
    retry_handler = RetryHandler(RETRY_CONFIGS["llm"])
    
    try:
        # 0. Safety pre-check: mask sensitive data for logging
        log_text = SafetyGuardrails.mask_sensitive_data(request.user_input)
        logger.info("Processing user input", 
                   session_id=request.session_id,
                   input_length=len(request.user_input))
        
        # 1. Classify intent with retry
        intent_result = await retry_handler.execute(
            intent_classifier.classify,
            text=request.user_input,
            context=request.context,
            operation_name="intent_classification"
        )
        
        logger.info("Intent classified",
                   session_id=request.session_id,
                   intent=intent_result.intent,
                   confidence=intent_result.confidence)
        
        # 2. Safety check on classified intent
        safety_result = SafetyGuardrails.get_safe_response(
            intent=intent_result.intent,
            confidence=intent_result.confidence,
            raw_text=request.user_input,
            context=request.context or {}
        )
        
        # Handle safety overrides
        intent_to_use = safety_result.get("intent_override") or intent_result.intent
        
        if safety_result["action"] == SafetyAction.CLARIFY:
            # Ask for clarification without executing workflow
            return ConversationResponse(
                session_id=request.session_id,
                intent=intent_result.intent,
                entities=intent_result.entities,
                response_text=safety_result["message"],
                audio_base64=None,
                context=request.context,
                is_complete=False,
                requires_human=False
            )
        
        # 3. Validate extracted entities
        validation_results = EntityValidator.validate_all(intent_result.entities)
        
        # Normalize valid entities
        normalized_entities = {}
        validation_errors = []
        
        for key, val_result in validation_results.items():
            if val_result["result"].value == "valid":
                normalized_entities[key] = val_result["normalized"]
            elif val_result["result"].value == "needs_confirmation":
                normalized_entities[key] = val_result["normalized"]
                # Could add to confirmation queue
            else:
                validation_errors.append(val_result["error"])
        
        # Merge normalized with original (for non-validated fields)
        final_entities = {**intent_result.entities, **normalized_entities}
        
        # CRITICAL: Add raw input for workflows that need to match user text (e.g., doctor selection)
        final_entities["_raw_input"] = request.user_input
        
        # 4. Execute workflow with potentially overridden intent
        workflow_result = await workflow_engine.execute(
            session_id=request.session_id,
            intent=intent_to_use,
            entities=final_entities,
            context=request.context
        )
        
        # 5. Check if safety requires human escalation
        if safety_result["action"] == SafetyAction.ESCALATE:
            workflow_result.requires_human = True
        
        # 6. Generate response
        response_text = workflow_result.response_text
        
        # If we had validation errors and response isn't about missing fields, append
        if validation_errors and "please provide" not in response_text.lower():
            # Already being handled by workflow
            pass
        
        # 7. Synthesize if audio requested (gracefully handle TTS failures)
        audio_base64 = None
        if request.return_audio:
            try:
                audio_base64 = await tts.synthesize(response_text)
            except Exception as tts_err:
                logger.warning("TTS synthesis failed", error=str(tts_err))
        
        logger.info("Conversation processed",
                   session_id=request.session_id,
                   workflow_complete=workflow_result.is_complete,
                   safety_action=safety_result["action"].value)
        
        return ConversationResponse(
            session_id=request.session_id,
            intent=intent_to_use,
            entities=final_entities,
            response_text=response_text,
            audio_base64=audio_base64,
            context=workflow_result.updated_context,
            is_complete=workflow_result.is_complete,
            requires_human=workflow_result.requires_human
        )
    except Exception as e:
        logger.error("Conversation processing failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Session Management Endpoints
# =============================================================================

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details and conversation history."""
    session = workflow_engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.delete("/session/{session_id}")
async def end_session(session_id: str):
    """End a conversation session."""
    success = workflow_engine.end_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    logger.info("Session ended", session_id=session_id)
    return {"status": "ended", "session_id": session_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.voice_agent_port,
        reload=True
    )
