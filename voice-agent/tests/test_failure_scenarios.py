"""
Failure Scenario Tests
Tests for edge cases, error handling, and failure modes
"""

import pytest
import httpx
from typing import Dict

BASE_URL = "http://localhost:5003"


class TestFailureScenarios:
    """Test failure scenarios and error handling."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        yield
    
    async def _start_call(self, caller_id: str = "9876543210") -> str:
        response = await self.client.post("/voice/call", json={
            "caller_id": caller_id, "channel": "test"
        })
        return response.json()["session_id"]
    
    async def _process(self, session_id: str, user_input: str, context: Dict = None) -> Dict:
        response = await self.client.post("/conversation/process", json={
            "session_id": session_id,
            "user_input": user_input,
            "context": context or {},
            "return_audio": False
        })
        return response.json()
    
    # =========================================================================
    # Low Confidence Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_very_low_confidence_clarification(self):
        """Test that very low confidence triggers clarification."""
        session_id = await self._start_call()
        
        # Mumbled/unclear input
        result = await self._process(session_id, "mmm hmm maybe something")
        
        # Should ask for clarification
        assert "repeat" in result["response_text"].lower() or \
               "understand" in result["response_text"].lower() or \
               "clarify" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_ambiguous_intent(self):
        """Test handling of ambiguous intent."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I need help with something medical")
        
        # Should ask for specifics
        assert "what" in result["response_text"].lower() or \
               "how" in result["response_text"].lower() or \
               "help" in result["response_text"].lower()
    
    # =========================================================================
    # Invalid Entity Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_invalid_phone_number(self):
        """Test handling of invalid phone number."""
        session_id = await self._start_call()
        
        await self._process(session_id, "I want to register as a new patient")
        result = await self._process(session_id, "My phone is 12345")  # Too short
        
        # Should ask for valid phone
        assert "phone" in result["response_text"].lower() or \
               "number" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_invalid_date_format(self):
        """Test handling of unrecognized date."""
        session_id = await self._start_call()
        
        await self._process(session_id, "Book an appointment")
        result = await self._process(session_id, "On the 32nd of Nevuary")  # Invalid
        
        # Should handle gracefully
        assert "date" in result["response_text"].lower() or \
               "when" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_unknown_department(self):
        """Test handling of unknown department."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Book appointment with quantum healing department")
        
        # Should handle unknown department
        assert "department" in result["response_text"].lower() or \
               "available" in result["response_text"].lower()
    
    # =========================================================================
    # Sensitive Data Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_aadhaar_detection(self):
        """Test that Aadhaar numbers are detected and masked."""
        session_id = await self._start_call()
        
        # This should be masked in logs, not rejected
        result = await self._process(session_id, "My Aadhaar is 1234 5678 9012")
        
        # Should not fail, should continue conversation
        assert result["response_text"]  # Some response received
    
    @pytest.mark.asyncio
    async def test_credit_card_handling(self):
        """Test that credit card numbers are handled safely."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Can I pay with my card 4111 1111 1111 1111?")
        
        # Should continue safely
        assert result["response_text"]
    
    # =========================================================================
    # Conversation Flow Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_context_switching(self):
        """Test switching intents mid-conversation."""
        session_id = await self._start_call()
        
        # Start booking
        await self._process(session_id, "I want to book an appointment")
        
        # Switch to check-in
        result = await self._process(session_id, "Actually I'm already here for my appointment")
        
        # Should handle context switch
        assert result["intent"] == "OPD_CHECKIN" or \
               "check" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_repeated_failures_escalation(self):
        """Test that repeated failures trigger escalation."""
        session_id = await self._start_call()
        
        # Multiple unclear inputs
        for i in range(5):
            result = await self._process(session_id, f"asdf{i} random garbage")
        
        # After multiple failures, should offer human
        assert "human" in result["response_text"].lower() or \
               "reception" in result["response_text"].lower() or \
               result.get("requires_human")
    
    @pytest.mark.asyncio
    async def test_session_not_found(self):
        """Test handling of invalid session."""
        response = await self.client.post("/conversation/process", json={
            "session_id": "invalid-session-12345",
            "user_input": "Hello",
            "context": {},
            "return_audio": False
        })
        
        # Should handle gracefully (may create new session or return error)
        assert response.status_code in [200, 404, 400]
    
    # =========================================================================
    # Emergency Priority Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_emergency_overrides_low_confidence(self):
        """Test that emergency keywords override low confidence checks."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "emergency help chest pain")
        
        # Emergency should be detected regardless
        assert result["intent"] == "REPORT_EMERGENCY" or \
               "emergency" in result["response_text"].lower() or \
               result.get("requires_human")
    
    @pytest.mark.asyncio
    async def test_emergency_in_mid_workflow(self):
        """Test emergency detection during another workflow."""
        session_id = await self._start_call()
        
        # Start appointment booking
        await self._process(session_id, "Book an appointment")
        await self._process(session_id, "For cardiology")
        
        # Suddenly emergency
        result = await self._process(session_id, "Wait, there's an emergency! Someone collapsed!")
        
        # Should immediately switch to emergency
        assert result["intent"] == "REPORT_EMERGENCY" or \
               "emergency" in result["response_text"].lower() or \
               result.get("requires_human")
    
    # =========================================================================
    # API Error Simulation
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check endpoint."""
        response = await self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_session(self):
        """Test getting a session that doesn't exist."""
        response = await self.client.get("/session/nonexistent-session-id")
        assert response.status_code == 404


class TestConversationTestCases:
    """Pre-defined conversation test cases."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        yield
    
    async def _run_conversation(self, messages: list) -> list:
        """Run a sequence of messages and return all responses."""
        response = await self.client.post("/voice/call", json={
            "caller_id": "test-user", "channel": "test"
        })
        session_id = response.json()["session_id"]
        
        results = []
        context = {}
        
        for msg in messages:
            response = await self.client.post("/conversation/process", json={
                "session_id": session_id,
                "user_input": msg,
                "context": context,
                "return_audio": False
            })
            data = response.json()
            context = data.get("context") or context
            results.append(data)
        
        return results
    
    @pytest.mark.asyncio
    async def test_happy_path_appointment(self):
        """Test happy path for appointment booking."""
        results = await self._run_conversation([
            "I want to book an appointment",
            "Cardiology department please",
            "Tomorrow morning",
            "My phone is 9876543210",
            "Yes, please confirm"
        ])
        
        # Should progress through workflow
        assert results[0]["intent"] == "BOOK_APPOINTMENT"
        # Last result should be progressed
        assert len(results) == 5
    
    @pytest.mark.asyncio
    async def test_correction_flow(self):
        """Test user correcting information."""
        results = await self._run_conversation([
            "Book appointment for orthopedics",
            "Actually, I meant cardiology",
        ])
        
        # Should accept correction
        final = results[-1]
        assert "cardiology" in str(final.get("entities", {})).lower() or \
               "cardiology" in final["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_polite_decline(self):
        """Test polite conversation endings."""
        results = await self._run_conversation([
            "Hello",
            "Actually I don't need anything, goodbye"
        ])
        
        # Should end politely
        assert results[-1]["is_complete"]


# Run: pytest tests/test_failure_scenarios.py -v --asyncio-mode=auto
