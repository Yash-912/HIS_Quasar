"""
Context Tracker
Manages multi-turn conversation state and session memory
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import uuid
import structlog

logger = structlog.get_logger()


@dataclass
class ConversationTurn:
    """Single turn in a conversation."""
    turn_id: int
    timestamp: datetime
    user_input: str
    intent: str
    entities: Dict[str, Any]
    response: str
    api_calls: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ConversationSession:
    """Complete conversation session."""
    session_id: str
    caller_id: str
    channel: str
    started_at: datetime
    last_activity: datetime
    turns: List[ConversationTurn] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    current_workflow: Optional[str] = None
    workflow_state: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    
    @property
    def turn_count(self) -> int:
        return len(self.turns)


class ContextTracker:
    """
    Manages conversation context across multiple turns.
    Tracks collected entities, workflow state, and session data.
    """
    
    def __init__(self, session_timeout: int = 300, max_turns: int = 20):
        """
        Initialize context tracker.
        
        Args:
            session_timeout: Session timeout in seconds
            max_turns: Maximum turns per session
        """
        self.session_timeout = session_timeout
        self.max_turns = max_turns
        self._sessions: Dict[str, ConversationSession] = {}
    
    def create_session(
        self,
        caller_id: str,
        channel: str = "phone"
    ) -> str:
        """
        Create new conversation session.
        
        Args:
            caller_id: Identifier for the caller
            channel: Communication channel
            
        Returns:
            New session ID
        """
        session_id = str(uuid.uuid4())
        now = datetime.now()
        
        session = ConversationSession(
            session_id=session_id,
            caller_id=caller_id,
            channel=channel,
            started_at=now,
            last_activity=now
        )
        
        self._sessions[session_id] = session
        
        logger.info("Session created",
                   session_id=session_id,
                   caller_id=caller_id,
                   channel=channel)
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[ConversationSession]:
        """Get session by ID."""
        session = self._sessions.get(session_id)
        
        if session and self._is_session_expired(session):
            logger.info("Session expired", session_id=session_id)
            session.is_active = False
            return None
        
        return session
    
    def _is_session_expired(self, session: ConversationSession) -> bool:
        """Check if session has expired."""
        expiry = session.last_activity + timedelta(seconds=self.session_timeout)
        return datetime.now() > expiry
    
    def add_turn(
        self,
        session_id: str,
        user_input: str,
        intent: str,
        entities: Dict[str, Any],
        response: str,
        api_calls: Optional[List[Dict]] = None
    ) -> bool:
        """
        Add a turn to the conversation.
        
        Args:
            session_id: Session ID
            user_input: What the user said
            intent: Classified intent
            entities: Extracted entities
            response: What we responded
            api_calls: API calls made during this turn
            
        Returns:
            True if turn added successfully
        """
        session = self.get_session(session_id)
        if not session:
            logger.warning("Cannot add turn - session not found", session_id=session_id)
            return False
        
        if session.turn_count >= self.max_turns:
            logger.warning("Session reached max turns", 
                          session_id=session_id,
                          max_turns=self.max_turns)
            session.is_active = False
            return False
        
        turn = ConversationTurn(
            turn_id=session.turn_count + 1,
            timestamp=datetime.now(),
            user_input=user_input,
            intent=intent,
            entities=entities,
            response=response,
            api_calls=api_calls or []
        )
        
        session.turns.append(turn)
        session.last_activity = datetime.now()
        
        # Merge entities into session context
        self._merge_entities(session, entities)
        
        logger.debug("Turn added",
                    session_id=session_id,
                    turn_id=turn.turn_id,
                    intent=intent)
        
        return True
    
    def _merge_entities(self, session: ConversationSession, entities: Dict[str, Any]):
        """Merge new entities into session context."""
        if not entities:
            return
        
        # Update context with new entities
        for key, value in entities.items():
            if value:  # Only merge non-empty values
                session.context[key] = value
    
    def get_context(self, session_id: str) -> Dict[str, Any]:
        """Get current context for a session."""
        session = self.get_session(session_id)
        if not session:
            return {}
        
        return {
            "session_id": session.session_id,
            "caller_id": session.caller_id,
            "turn_count": session.turn_count,
            "current_workflow": session.current_workflow,
            "workflow_state": session.workflow_state,
            "collected_entities": session.context,
            "recent_turns": [
                {
                    "user": turn.user_input,
                    "intent": turn.intent,
                    "response": turn.response[:100]  # Truncate for context
                }
                for turn in session.turns[-5:]  # Last 5 turns
            ]
        }
    
    def set_workflow(
        self,
        session_id: str,
        workflow_name: str,
        initial_state: Optional[Dict[str, Any]] = None
    ):
        """
        Set the current workflow for a session.
        
        Args:
            session_id: Session ID
            workflow_name: Name of the workflow
            initial_state: Initial workflow state
        """
        session = self.get_session(session_id)
        if session:
            session.current_workflow = workflow_name
            session.workflow_state = initial_state or {}
            logger.info("Workflow set",
                       session_id=session_id,
                       workflow=workflow_name)
    
    def update_workflow_state(self, session_id: str, updates: Dict[str, Any]):
        """Update workflow state."""
        session = self.get_session(session_id)
        if session:
            old_keys = list(session.workflow_state.keys())
            session.workflow_state.update(updates)
            logger.info("CONTEXT_TRACKER: Workflow state updated",
                       session_id=session_id,
                       old_keys=old_keys,
                       updated_keys=list(updates.keys()),
                       new_total_keys=list(session.workflow_state.keys()),
                       has_available_doctors="available_doctors" in session.workflow_state,
                       doctor_id=session.workflow_state.get("doctor_id"))
    
    def clear_workflow(self, session_id: str):
        """Clear current workflow."""
        session = self.get_session(session_id)
        if session:
            logger.info("CONTEXT_TRACKER: Workflow cleared",
                       session_id=session_id,
                       cleared_workflow=session.current_workflow)
            session.current_workflow = None
            session.workflow_state = {}
    
    def end_session(self, session_id: str) -> bool:
        """
        End a conversation session.
        
        Args:
            session_id: Session ID
            
        Returns:
            True if session was ended
        """
        session = self.get_session(session_id)
        if session:
            session.is_active = False
            logger.info("Session ended",
                       session_id=session_id,
                       total_turns=session.turn_count)
            return True
        return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions from memory."""
        expired = []
        for session_id, session in self._sessions.items():
            if self._is_session_expired(session):
                expired.append(session_id)
        
        for session_id in expired:
            del self._sessions[session_id]
        
        if expired:
            logger.info("Cleaned up expired sessions", count=len(expired))
