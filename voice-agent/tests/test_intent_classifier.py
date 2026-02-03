"""
Tests for Intent Classifier
"""

import pytest
from app.conversation.intent_classifier import IntentClassifier


class TestIntentClassifier:
    """Test intent classification."""
    
    @pytest.fixture
    def classifier(self):
        """Create classifier instance (mock mode)."""
        return IntentClassifier(provider="gemini", api_key=None)
    
    def test_fallback_greeting(self, classifier):
        """Test fallback detects greeting."""
        result = classifier._fallback_classification("Hello, good morning")
        assert result.intent == "GREETING"
        assert result.confidence >= 0.7
    
    def test_fallback_emergency(self, classifier):
        """Test fallback detects emergency."""
        result = classifier._fallback_classification("This is an emergency!")
        assert result.intent == "REPORT_EMERGENCY"
        assert result.confidence >= 0.9
    
    def test_fallback_appointment(self, classifier):
        """Test fallback detects appointment intent."""
        result = classifier._fallback_classification("I want to book an appointment")
        assert result.intent == "BOOK_APPOINTMENT"
    
    def test_fallback_phone_extraction(self, classifier):
        """Test fallback extracts phone number."""
        result = classifier._fallback_classification("My number is 9876543210")
        assert result.intent == "PROVIDE_INFORMATION"
        assert result.entities.get("phone") == "9876543210"
    
    def test_fallback_escalation(self, classifier):
        """Test fallback detects escalation request."""
        result = classifier._fallback_classification("I want to speak to a person")
        assert result.intent == "ESCALATE_TO_HUMAN"


class TestIntentClassifierParsing:
    """Test LLM response parsing."""
    
    @pytest.fixture
    def classifier(self):
        return IntentClassifier(provider="gemini", api_key=None)
    
    def test_parse_json_response(self, classifier):
        """Test parsing clean JSON response."""
        response = '''
        {
            "intent": "BOOK_APPOINTMENT",
            "confidence": 0.95,
            "entities": {"department": "cardiology"},
            "required_missing_fields": ["patient_identifier"]
        }
        '''
        result = classifier._parse_llm_response(response)
        assert result.intent == "BOOK_APPOINTMENT"
        assert result.confidence == 0.95
        assert result.entities.get("department") == "cardiology"
    
    def test_parse_markdown_wrapped_json(self, classifier):
        """Test parsing JSON wrapped in markdown code blocks."""
        response = '''
        Here's my analysis:
        
        ```json
        {
            "intent": "REGISTER_PATIENT",
            "confidence": 0.88,
            "entities": {"first_name": "John"},
            "required_missing_fields": ["phone"]
        }
        ```
        '''
        result = classifier._parse_llm_response(response)
        assert result.intent == "REGISTER_PATIENT"
        assert result.entities.get("first_name") == "John"
    
    def test_parse_invalid_json(self, classifier):
        """Test handling of invalid JSON."""
        response = "This is not valid JSON at all"
        result = classifier._parse_llm_response(response)
        assert result.intent == "UNCLEAR"
        assert result.confidence == 0.3
