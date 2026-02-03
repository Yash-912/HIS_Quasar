"""
Pydantic Response Models for Voice Agent API
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class VoiceCallResponse(BaseModel):
    """Response for voice call initiation."""
    session_id: str = Field(..., description="Created session ID")
    response_text: str = Field(..., description="Greeting text")
    audio_base64: Optional[str] = Field(None, description="Synthesized audio of greeting")
    requires_input: bool = Field(default=True, description="Whether expecting user input")


class TranscribeResponse(BaseModel):
    """Response for audio transcription."""
    session_id: str
    transcript: str = Field(..., description="Transcribed text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Transcription confidence")
    alternatives: Optional[List[str]] = Field(default=[], description="Alternative transcriptions")


class SynthesizeResponse(BaseModel):
    """Response for text-to-speech synthesis."""
    audio_base64: str = Field(..., description="Base64 encoded audio")
    duration_seconds: float = Field(..., description="Audio duration in seconds")


class ConversationResponse(BaseModel):
    """Response for conversation processing."""
    session_id: str
    intent: str = Field(..., description="Classified intent")
    entities: Dict[str, Any] = Field(default={}, description="Extracted entities")
    response_text: str = Field(..., description="Response to speak to user")
    audio_base64: Optional[str] = Field(None, description="Synthesized audio response")
    context: Dict[str, Any] = Field(default={}, description="Updated conversation context")
    is_complete: bool = Field(default=False, description="Whether workflow is complete")
    requires_human: bool = Field(default=False, description="Whether to escalate to human")
    next_prompt: Optional[str] = Field(None, description="Hint for next expected input")


class IntentResult(BaseModel):
    """Result of intent classification."""
    intent: str = Field(..., description="Classified intent name")
    confidence: float = Field(..., ge=0.0, le=1.0)
    entities: Dict[str, Any] = Field(default={})
    required_missing_fields: List[str] = Field(default=[])


class WorkflowResult(BaseModel):
    """Result of workflow execution."""
    success: bool
    response_text: str
    updated_context: Dict[str, Any] = Field(default={})
    is_complete: bool = Field(default=False)
    requires_human: bool = Field(default=False)
    api_calls_made: List[Dict[str, Any]] = Field(default=[])
    error: Optional[str] = None


class SessionInfo(BaseModel):
    """Session information."""
    session_id: str
    caller_id: str
    channel: str
    started_at: str
    last_activity: str
    turn_count: int
    current_workflow: Optional[str] = None
    context: Dict[str, Any] = Field(default={})
