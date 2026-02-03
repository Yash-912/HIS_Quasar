"""
Workflow Coverage Tests
End-to-end tests for all voice agent workflows against live HIS backend
"""

import pytest
import httpx
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:5003"
HIS_URL = "http://localhost:5001/api"


class TestVoiceAgentWorkflows:
    """Integration tests for voice agent workflows."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test client."""
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        yield
        # Cleanup handled by fixture
    
    async def _process(self, session_id: str, user_input: str, context: Dict = None) -> Dict:
        """Helper to call conversation/process endpoint."""
        response = await self.client.post("/conversation/process", json={
            "session_id": session_id,
            "user_input": user_input,
            "context": context or {},
            "return_audio": False
        })
        return response.json()
    
    async def _start_call(self, caller_id: str = "9876543210") -> str:
        """Start a voice call and return session_id."""
        response = await self.client.post("/voice/call", json={
            "caller_id": caller_id,
            "channel": "test"
        })
        return response.json()["session_id"]
    
    # =========================================================================
    # Patient Registration Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_new_patient_registration_flow(self):
        """Test complete new patient registration."""
        session_id = await self._start_call("9999000001")
        
        # Step 1: Express intent
        result = await self._process(session_id, "I want to register as a new patient")
        assert result["intent"] == "REGISTER_PATIENT"
        assert "name" in result["response_text"].lower()
        
        # Step 2: Provide name
        result = await self._process(session_id, "My name is Rahul Kumar", result.get("context"))
        assert "first_name" in result["entities"] or "Rahul" in result["response_text"]
        
        # Step 3: Provide phone
        result = await self._process(session_id, "My phone is 9876543210", result.get("context"))
        
        # Step 4: Provide DOB
        result = await self._process(session_id, "I was born on 15 March 1990", result.get("context"))
        
        # Step 5: Provide gender
        result = await self._process(session_id, "Male", result.get("context"))
        
        # Should complete or ask for confirmation
        assert result["is_complete"] or "confirm" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_find_existing_patient(self):
        """Test finding existing patient by phone."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I am already registered here, my phone is 9876543210")
        
        # Should either find patient or ask for more info
        assert result["intent"] in ["FIND_PATIENT", "REGISTER_PATIENT", "PROVIDE_INFORMATION"]
    
    # =========================================================================
    # Appointment Booking Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_book_appointment_with_department(self):
        """Test appointment booking with department specified."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I want to book an appointment with cardiology")
        assert result["intent"] == "BOOK_APPOINTMENT"
        assert "cardiology" in result["entities"].get("department", "").lower() or \
               "Cardiology" in result["response_text"]
    
    @pytest.mark.asyncio
    async def test_book_appointment_general(self):
        """Test general appointment booking request."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I need to see a doctor")
        assert result["intent"] == "BOOK_APPOINTMENT"
        # Should ask for department or symptoms
    
    @pytest.mark.asyncio
    async def test_book_appointment_with_date(self):
        """Test appointment booking with preferred date."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Book appointment for tomorrow with orthopedics")
        assert "tomorrow" in str(result["entities"]).lower() or \
               "date" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_reschedule_appointment(self):
        """Test appointment rescheduling."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I need to reschedule my appointment")
        assert result["intent"] == "RESCHEDULE_APPOINTMENT"
    
    @pytest.mark.asyncio
    async def test_cancel_appointment(self):
        """Test appointment cancellation."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I want to cancel my appointment")
        assert result["intent"] == "CANCEL_APPOINTMENT"
        # Should ask for confirmation
        assert "confirm" in result["response_text"].lower() or \
               "appointment" in result["response_text"].lower()
    
    # =========================================================================
    # OPD Check-in Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_opd_checkin(self):
        """Test OPD check-in flow."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I am here for my appointment")
        assert result["intent"] == "OPD_CHECKIN"
    
    @pytest.mark.asyncio
    async def test_opd_queue_status(self):
        """Test checking OPD queue status."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "How long is the wait?")
        assert result["intent"] in ["OPD_QUEUE_STATUS", "GENERAL_STATUS_INQUIRY"]
    
    # =========================================================================
    # Bed Allocation Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_check_bed_availability(self):
        """Test bed availability check."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Are there any beds available?")
        assert result["intent"] == "CHECK_BED_AVAILABILITY"
        # Should return availability info
        assert "bed" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_request_admission(self):
        """Test admission request."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I need to be admitted to the hospital")
        assert result["intent"] in ["REQUEST_ADMISSION", "REQUEST_BED_ALLOCATION"]
        # Should mention doctor approval needed
        assert "doctor" in result["response_text"].lower() or \
               "approval" in result["response_text"].lower() or \
               "human" in result["response_text"].lower()
    
    # =========================================================================
    # Lab Test Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_book_lab_test(self):
        """Test lab test booking."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I need to get a blood test done")
        assert result["intent"] == "BOOK_LAB_TEST"
        # Should mention prescription requirement
        assert "prescription" in result["response_text"].lower() or \
               "doctor" in result["response_text"].lower() or \
               "lab" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_check_lab_status(self):
        """Test lab result status check."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Are my lab results ready?")
        assert result["intent"] in ["CHECK_LAB_STATUS", "GENERAL_STATUS_INQUIRY"]
    
    # =========================================================================
    # Status Inquiry Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_check_appointment_status(self):
        """Test appointment status check."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Do I have any upcoming appointments?")
        assert result["intent"] in ["CHECK_APPOINTMENT_STATUS", "GENERAL_STATUS_INQUIRY"]
    
    @pytest.mark.asyncio
    async def test_check_bill_status(self):
        """Test bill status check."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "What's my bill amount?")
        assert result["intent"] in ["CHECK_BILL_STATUS", "GENERAL_STATUS_INQUIRY"]
    
    # =========================================================================
    # Emergency & Escalation Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_emergency_detection(self):
        """Test emergency detection and response."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "This is an emergency! Someone is having a heart attack!")
        
        # Should override to emergency intent
        assert result["intent"] == "REPORT_EMERGENCY" or result["requires_human"]
        # Should provide urgent guidance
        assert "emergency" in result["response_text"].lower() or \
               "108" in result["response_text"] or \
               "team" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_human_escalation(self):
        """Test human escalation request."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "I want to speak to a real person")
        assert result["intent"] == "ESCALATE_TO_HUMAN"
        assert result["requires_human"]
    
    # =========================================================================
    # Multi-turn Conversation Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_multi_turn_appointment_booking(self):
        """Test multi-turn conversation for appointment booking."""
        session_id = await self._start_call("9876543210")
        context = {}
        
        # Turn 1: Start booking
        result = await self._process(session_id, "I want to book an appointment", context)
        context = result.get("context") or {}
        
        # Turn 2: Provide phone if asked
        if "phone" in result["response_text"].lower() or "patient" in result["response_text"].lower():
            result = await self._process(session_id, "My phone number is 9876543210", context)
            context = result.get("context") or {}
        
        # Turn 3: Provide department
        result = await self._process(session_id, "I need to see a cardiologist", context)
        context = result.get("context") or {}
        
        # Turn 4: Provide date
        result = await self._process(session_id, "Tomorrow would be good", context)
        
        # Should progress through the flow
        assert "entities" in result
    
    # =========================================================================
    # Edge Case Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_unclear_input(self):
        """Test handling of unclear input."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "asdfghjkl random gibberish")
        # Should ask for clarification
        assert result["intent"] == "UNCLEAR" or \
               "understand" in result["response_text"].lower() or \
               "repeat" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_greeting(self):
        """Test greeting response."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Hello!")
        assert result["intent"] == "GREETING"
        assert "help" in result["response_text"].lower()
    
    @pytest.mark.asyncio
    async def test_goodbye(self):
        """Test goodbye handling."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "Goodbye, thank you")
        assert result["intent"] == "GOODBYE"
        assert result["is_complete"]
    
    @pytest.mark.asyncio
    async def test_help_request(self):
        """Test help request."""
        session_id = await self._start_call()
        
        result = await self._process(session_id, "What can you help me with?")
        assert result["intent"] == "HELP"
        # Should list capabilities
        assert "appointment" in result["response_text"].lower()


# Run with: pytest tests/test_workflows_e2e.py -v --asyncio-mode=auto
