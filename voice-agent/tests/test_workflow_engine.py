"""
Tests for Workflow Engine
"""

import pytest
from unittest.mock import AsyncMock, patch
from app.orchestration.workflow_engine import WorkflowEngine


class TestWorkflowEngine:
    """Test workflow engine functionality."""
    
    @pytest.fixture
    def engine(self, mock_his_client):
        """Create workflow engine with mock client."""
        return WorkflowEngine(his_client=mock_his_client)
    
    def test_create_session(self, engine):
        """Test session creation."""
        session_id = engine.create_session(
            caller_id="9876543210",
            channel="phone"
        )
        assert session_id is not None
        assert len(session_id) > 0
    
    def test_get_session(self, engine):
        """Test session retrieval."""
        session_id = engine.create_session("9876543210", "phone")
        session = engine.get_session(session_id)
        
        assert session is not None
        assert session["caller_id"] == "9876543210"
        assert session["channel"] == "phone"
    
    def test_end_session(self, engine):
        """Test session termination."""
        session_id = engine.create_session("9876543210", "phone")
        result = engine.end_session(session_id)
        
        assert result is True
        assert engine.get_session(session_id) is None
    
    @pytest.mark.asyncio
    async def test_generate_greeting(self, engine):
        """Test greeting generation."""
        greeting = await engine.generate_greeting()
        
        assert "Welcome" in greeting or "City Hospital" in greeting
        assert "help" in greeting.lower()
    
    @pytest.mark.asyncio
    async def test_execute_greeting(self, engine):
        """Test executing greeting intent."""
        session_id = engine.create_session("9876543210", "phone")
        
        result = await engine.execute(
            session_id=session_id,
            intent="GREETING",
            entities={},
            context={}
        )
        
        assert result.success is True
        assert "Welcome" in result.response_text or "help" in result.response_text.lower()
    
    @pytest.mark.asyncio
    async def test_execute_goodbye(self, engine):
        """Test executing goodbye intent."""
        session_id = engine.create_session("9876543210", "phone")
        
        result = await engine.execute(
            session_id=session_id,
            intent="GOODBYE",
            entities={},
            context={}
        )
        
        assert result.success is True
        assert result.is_complete is True
        assert "thank" in result.response_text.lower()
    
    @pytest.mark.asyncio
    async def test_execute_help(self, engine):
        """Test executing help intent."""
        session_id = engine.create_session("9876543210", "phone")
        
        result = await engine.execute(
            session_id=session_id,
            intent="HELP",
            entities={},
            context={}
        )
        
        assert result.success is True
        assert "appointment" in result.response_text.lower()
