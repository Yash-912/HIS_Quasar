"""
Pydantic Request Models for Voice Agent API
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class VoiceCallRequest(BaseModel):
    """Request to initiate a voice call session."""
    caller_id: str = Field(..., description="Unique identifier for the caller (phone number or ID)")
    channel: str = Field(default="phone", description="Channel: phone, web, mobile")
    language: Optional[str] = Field(default="en-IN", description="Language code")


class TranscribeRequest(BaseModel):
    """Request to transcribe audio to text."""
    session_id: str = Field(..., description="Active session ID")
    audio_base64: str = Field(..., description="Base64 encoded audio data")
    sample_rate: int = Field(default=16000, description="Audio sample rate in Hz")
    encoding: str = Field(default="LINEAR16", description="Audio encoding format")


class SynthesizeRequest(BaseModel):
    """Request to synthesize text to speech."""
    text: str = Field(..., description="Text to synthesize")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    pitch: float = Field(default=0.0, ge=-10.0, le=10.0, description="Voice pitch adjustment")


class ConversationRequest(BaseModel):
    """Request to process a conversation turn."""
    session_id: str = Field(..., description="Active session ID")
    user_input: str = Field(..., description="User's transcribed speech or text input")
    context: Optional[Dict[str, Any]] = Field(default={}, description="Current conversation context")
    return_audio: bool = Field(default=True, description="Whether to return synthesized audio")


class PatientLookupRequest(BaseModel):
    """Request to lookup patient by various identifiers."""
    session_id: str
    identifier_type: str = Field(..., description="Type: phone, patient_id, name")
    identifier_value: str


class AppointmentBookingRequest(BaseModel):
    """Request to book an appointment."""
    session_id: str
    patient_id: str
    department_id: str
    doctor_id: Optional[str] = None
    preferred_date: str  # ISO format
    time_preference: Optional[str] = Field(default="any", description="morning, afternoon, evening, any")
    chief_complaint: Optional[str] = None
