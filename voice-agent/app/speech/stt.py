"""
Speech-to-Text Module
Google Cloud Speech-to-Text integration with fallback mock mode
"""

import base64
from typing import AsyncIterator, Optional
import structlog

logger = structlog.get_logger()


class SpeechToText:
    """
    Google Cloud Speech-to-Text wrapper.
    Falls back to mock mode if credentials not available.
    """
    
    def __init__(self, language: str = "en-IN", sample_rate: int = 16000):
        """
        Initialize STT client.
        
        Args:
            language: Language code (default: Indian English)
            sample_rate: Audio sample rate in Hz
        """
        self.language = language
        self.sample_rate = sample_rate
        self._client = None
        self._mock_mode = False
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Cloud Speech client."""
        try:
            from google.cloud import speech_v1
            self._client = speech_v1.SpeechClient()
            logger.info("Google Cloud STT client initialized")
        except Exception as e:
            logger.warning("Google Cloud STT not available, using mock mode", error=str(e))
            self._mock_mode = True
    
    async def transcribe(self, audio_base64: str, sample_rate: int = None) -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_base64: Base64 encoded audio data
            sample_rate: Optional sample rate override
            
        Returns:
            Transcribed text
        """
        if not audio_base64:
            return ""
        
        if self._mock_mode:
            logger.warning("STT in mock mode - returning placeholder")
            return "[Mock transcription - configure GCP credentials for real STT]"
        
        try:
            from google.cloud import speech_v1
            
            audio_content = base64.b64decode(audio_base64)
            
            audio = speech_v1.RecognitionAudio(content=audio_content)
            config = speech_v1.RecognitionConfig(
                encoding=speech_v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                # sample_rate is auto-detected for WEBM_OPUS
                language_code=self.language,
                enable_automatic_punctuation=True,
                model="latest_long",
            )
            
            response = self._client.recognize(config=config, audio=audio)
            
            transcript = ""
            for result in response.results:
                transcript += result.alternatives[0].transcript
            
            logger.info("Transcription complete", length=len(transcript))
            return transcript
            
        except Exception as e:
            logger.error("Transcription failed", error=str(e))
            return f"[Transcription error: {str(e)}]"
    
    async def transcribe_streaming(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """
        Streaming transcription (currently batch mode).
        
        Real streaming requires WebSocket implementation.
        This method collects audio and processes in batch.
        """
        if self._mock_mode:
            logger.warning("Streaming STT in mock mode")
            yield "[Mock streaming transcription]"
            return
        
        # Collect audio chunks (simplified batch mode)
        logger.warning("Streaming transcription using batch mode")
        
        audio_chunks = []
        async for chunk in audio_stream:
            audio_chunks.append(chunk)
        
        if audio_chunks:
            combined_audio = b''.join(audio_chunks)
            audio_base64 = base64.b64encode(combined_audio).decode('utf-8')
            result = await self.transcribe(audio_base64)
            yield result
        else:
            yield ""


class MockSpeechToText:
    """Mock STT for testing without GCP credentials."""
    
    def __init__(self, language: str = "en-IN"):
        self.language = language
        logger.info("MockSpeechToText initialized")
    
    async def transcribe(self, audio_base64: str, sample_rate: int = 16000) -> str:
        """Return mock transcription."""
        if not audio_base64:
            return ""
        
        # Return a mock response based on audio length
        audio_length = len(audio_base64) if audio_base64 else 0
        
        if audio_length < 100:
            return "[Short audio detected]"
        elif audio_length < 1000:
            return "[Mock: Hello, I need help]"
        else:
            return "[Mock: I would like to book an appointment please]"
    
    async def transcribe_streaming(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Mock streaming transcription."""
        yield "[Mock streaming transcription - configure GCP for real STT]"
