"""
Test configuration and fixtures
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock

# Configure pytest for async tests
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_his_client():
    """Mock HIS client for testing."""
    client = AsyncMock()
    client.is_authenticated = True
    
    # Mock common responses
    client.search_patients.return_value = [{
        "_id": "patient123",
        "patientId": "HIS-2024-001",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "9876543210"
    }]
    
    client.get_departments.return_value = [
        {"_id": "dept1", "name": "General Medicine"},
        {"_id": "dept2", "name": "Cardiology"},
        {"_id": "dept3", "name": "Orthopedics"}
    ]
    
    client.create_appointment.return_value = {
        "_id": "apt123",
        "appointmentNumber": "APT-2024-001",
        "tokenNumber": "T-15",
        "status": "scheduled"
    }
    
    client.get_bed_availability.return_value = {
        "total": 100,
        "available": 25,
        "occupied": 75
    }
    
    return client


@pytest.fixture
def mock_intent_classifier():
    """Mock intent classifier for testing."""
    from app.models.responses import IntentResult
    
    classifier = AsyncMock()
    classifier.classify.return_value = IntentResult(
        intent="BOOK_APPOINTMENT",
        confidence=0.95,
        entities={"department": "cardiology"},
        required_missing_fields=["patient_identifier"]
    )
    
    return classifier


@pytest.fixture
def sample_conversation_context():
    """Sample conversation context for testing."""
    return {
        "session_id": "test-session-123",
        "caller_id": "9876543210",
        "turn_count": 2,
        "current_workflow": None,
        "collected_entities": {},
        "recent_turns": []
    }
