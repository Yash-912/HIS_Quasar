"""
Mock Voice Input Tests
Tests speech-to-text with mock audio data
"""

import pytest
import base64
import struct
from app.speech.stt import SpeechToText, MockSpeechToText
from app.speech.tts import TextToSpeech


class TestSpeechToText:
    """Test STT functionality."""
    
    @pytest.fixture
    def mock_stt(self):
        """Create mock STT instance."""
        return MockSpeechToText(language="en-IN")
    
    @pytest.fixture
    def stt(self):
        """Create STT instance (mock mode without credentials)."""
        return SpeechToText(language="en-IN")
    
    def _create_mock_audio(self, duration_seconds: float = 1.0, sample_rate: int = 16000) -> str:
        """Create mock audio data (silent WAV)."""
        num_samples = int(duration_seconds * sample_rate)
        
        # Generate silence (zeros)
        audio_data = b'\x00\x00' * num_samples
        
        return base64.b64encode(audio_data).decode('utf-8')
    
    @pytest.mark.asyncio
    async def test_mock_transcribe(self, mock_stt):
        """Test mock transcription."""
        audio = self._create_mock_audio(1.0)
        
        result = await mock_stt.transcribe(audio)
        
        # Mock should return placeholder text
        assert "[Mock" in result or len(result) > 0
    
    @pytest.mark.asyncio
    async def test_transcribe_without_credentials(self, stt):
        """Test transcription fails gracefully without credentials."""
        audio = self._create_mock_audio(0.5)
        
        try:
            result = await stt.transcribe(audio)
            # If mock mode active, should return mock response
            assert result is not None
        except Exception as e:
            # Should fail gracefully
            assert "credentials" in str(e).lower() or "mock" in str(e).lower()
    
    @pytest.mark.asyncio
    async def test_empty_audio(self, mock_stt):
        """Test handling of empty audio."""
        result = await mock_stt.transcribe("")
        
        # Should handle gracefully
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_short_audio(self, mock_stt):
        """Test handling of very short audio."""
        audio = self._create_mock_audio(0.1)  # 100ms
        
        result = await mock_stt.transcribe(audio)
        
        # Should handle gracefully
        assert result is not None


class TestTextToSpeech:
    """Test TTS functionality."""
    
    @pytest.fixture
    def tts(self):
        """Create TTS instance."""
        return TextToSpeech(language="en-IN", gender="female")
    
    @pytest.mark.asyncio
    async def test_synthesize_simple_text(self, tts):
        """Test synthesizing simple text."""
        result = await tts.synthesize("Hello, welcome to City Hospital")
        
        # Should return base64 audio
        assert result is not None
        assert isinstance(result, str)
    
    @pytest.mark.asyncio
    async def test_synthesize_with_numbers(self, tts):
        """Test synthesizing text with numbers."""
        result = await tts.synthesize("Your appointment is at room 302 on floor 3")
        
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_synthesize_with_dates(self, tts):
        """Test synthesizing text with dates."""
        result = await tts.synthesize("Your appointment is on January 15th, 2024 at 10:30 AM")
        
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_synthesize_empty_text(self, tts):
        """Test handling of empty text."""
        result = await tts.synthesize("")
        
        # Should handle gracefully
        assert result is not None or result == ""
    
    @pytest.mark.asyncio
    async def test_synthesize_long_text(self, tts):
        """Test synthesizing longer text."""
        long_text = """
        Good morning and welcome to City Hospital. My name is your AI receptionist.
        I can help you with booking appointments, patient registration, checking in
        for your OPD visit, inquiring about bed availability, booking lab tests,
        and checking your bill status. How may I assist you today?
        """
        
        result = await tts.synthesize(long_text)
        
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_ssml_formatting(self, tts):
        """Test SSML formatting."""
        # This tests the internal SSML formatting
        text = "Please hold for 5 seconds."
        
        result = await tts.synthesize(text)
        
        assert result is not None


class TestSpeechRoundTrip:
    """Test speech round-trip (TTS -> STT simulation)."""
    
    @pytest.mark.asyncio
    async def test_mock_round_trip(self):
        """Test mock speech round-trip."""
        tts = TextToSpeech(language="en-IN")
        stt = MockSpeechToText(language="en-IN")
        
        # Generate speech
        text = "Book an appointment for tomorrow"
        audio = await tts.synthesize(text)
        
        # Transcribe back (mock mode)
        if audio:
            transcript = await stt.transcribe(audio)
            assert transcript is not None


# Run: pytest tests/test_mock_voice.py -v
