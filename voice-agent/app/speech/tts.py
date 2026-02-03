"""
Text-to-Speech (TTS) Adapter
Converts text to speech audio using Google Cloud Text-to-Speech
"""

import base64
from typing import Literal
import structlog

logger = structlog.get_logger()


class TextToSpeech:
    """
    Text-to-Speech adapter using Google Cloud TTS API.
    Configured for natural-sounding Indian English voice.
    """
    
    # Voice configurations for different languages/regions
    VOICE_CONFIGS = {
        "en-IN": {
            "FEMALE": {"name": "en-IN-Wavenet-A", "ssml_gender": "FEMALE"},
            "MALE": {"name": "en-IN-Wavenet-B", "ssml_gender": "MALE"},
            "NEUTRAL": {"name": "en-IN-Standard-A", "ssml_gender": "NEUTRAL"},
        },
        "en-US": {
            "FEMALE": {"name": "en-US-Wavenet-F", "ssml_gender": "FEMALE"},
            "MALE": {"name": "en-US-Wavenet-D", "ssml_gender": "MALE"},
            "NEUTRAL": {"name": "en-US-Standard-C", "ssml_gender": "NEUTRAL"},
        },
        "hi-IN": {
            "FEMALE": {"name": "hi-IN-Wavenet-A", "ssml_gender": "FEMALE"},
            "MALE": {"name": "hi-IN-Wavenet-B", "ssml_gender": "MALE"},
            "NEUTRAL": {"name": "hi-IN-Standard-A", "ssml_gender": "NEUTRAL"},
        },
    }
    
    def __init__(
        self,
        language: str = "en-IN",
        gender: Literal["MALE", "FEMALE", "NEUTRAL"] = "FEMALE"
    ):
        """
        Initialize TTS with voice configuration.
        
        Args:
            language: BCP-47 language code
            gender: Voice gender preference
        """
        self.language = language
        self.gender = gender
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Cloud TTS client."""
        try:
            from google.cloud import texttospeech
            self.client = texttospeech.TextToSpeechClient()
            self.tts = texttospeech
            logger.info("Google Cloud TTS client initialized", 
                       language=self.language, 
                       gender=self.gender)
        except Exception as e:
            logger.warning("Google Cloud TTS not available, using mock mode", error=str(e))
            self.client = None
    
    def _get_voice_config(self):
        """Get voice configuration for current language and gender."""
        lang_config = self.VOICE_CONFIGS.get(self.language, self.VOICE_CONFIGS["en-IN"])
        return lang_config.get(self.gender, lang_config["FEMALE"])
    
    async def synthesize(
        self,
        text: str,
        speed: float = 1.0,
        pitch: float = 0.0,
        use_ssml: bool = False
    ) -> str:
        """
        Synthesize text to speech audio.
        
        Args:
            text: Text to synthesize (or SSML if use_ssml=True)
            speed: Speaking rate (0.5 to 2.0, 1.0 is normal)
            pitch: Voice pitch adjustment (-10.0 to 10.0)
            use_ssml: Whether text is SSML formatted
            
        Returns:
            Base64 encoded audio data (MP3 format)
        """
        if not self.client:
            # Mock mode for development
            logger.warning("TTS in mock mode - returning empty audio")
            return ""
        
        try:
            # Get voice configuration
            voice_config = self._get_voice_config()
            
            # Prepare input
            if use_ssml:
                synthesis_input = self.tts.SynthesisInput(ssml=text)
            else:
                # Wrap in SSML for better control
                ssml_text = self._text_to_ssml(text)
                synthesis_input = self.tts.SynthesisInput(ssml=ssml_text)
            
            # Voice selection
            voice = self.tts.VoiceSelectionParams(
                language_code=self.language,
                name=voice_config["name"],
                ssml_gender=getattr(
                    self.tts.SsmlVoiceGender, 
                    voice_config["ssml_gender"]
                ),
            )
            
            # Audio configuration
            audio_config = self.tts.AudioConfig(
                audio_encoding=self.tts.AudioEncoding.MP3,
                speaking_rate=speed,
                pitch=pitch,
                # Effects for better phone quality
                effects_profile_id=["telephony-class-application"],
            )
            
            # Synthesize
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            # Encode to base64
            audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
            
            logger.info("Speech synthesized",
                       text_length=len(text),
                       audio_bytes=len(response.audio_content))
            
            return audio_base64
            
        except Exception as e:
            logger.error("Speech synthesis failed", error=str(e))
            raise
    
    def _text_to_ssml(self, text: str) -> str:
        """
        Convert plain text to SSML with appropriate prosody.
        
        Args:
            text: Plain text
            
        Returns:
            SSML formatted text
        """
        # Add pauses after punctuation, emphasis on numbers
        ssml = f"""
        <speak>
            <prosody rate="medium" pitch="0st">
                {self._escape_ssml(text)}
            </prosody>
        </speak>
        """
        return ssml.strip()
    
    def _escape_ssml(self, text: str) -> str:
        """Escape special characters for SSML."""
        replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        return text
    
    async def synthesize_with_breaks(
        self,
        segments: list[tuple[str, float]]
    ) -> str:
        """
        Synthesize multiple segments with custom pauses.
        
        Args:
            segments: List of (text, pause_seconds) tuples
            
        Returns:
            Base64 encoded audio
        """
        ssml_parts = ['<speak>']
        
        for text, pause in segments:
            ssml_parts.append(f'<p>{self._escape_ssml(text)}</p>')
            if pause > 0:
                ssml_parts.append(f'<break time="{int(pause * 1000)}ms"/>')
        
        ssml_parts.append('</speak>')
        ssml = ''.join(ssml_parts)
        
        return await self.synthesize(ssml, use_ssml=True)


class MockTextToSpeech(TextToSpeech):
    """Mock TTS for testing without cloud credentials."""
    
    def __init__(self, language: str = "en-IN", gender: str = "FEMALE"):
        self.language = language
        self.gender = gender
        self.client = None
    
    async def synthesize(self, text: str, speed: float = 1.0, pitch: float = 0.0, use_ssml: bool = False) -> str:
        """Return empty audio for testing."""
        logger.debug("Mock TTS synthesize called", text=text[:50])
        return ""
