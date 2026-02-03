"""
Base Workflow Class
Abstract base for all conversation workflows
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import structlog

from app.models.intents import Intent, INTENT_CONFIGS
from app.models.responses import WorkflowResult
from app.integration.his_client import HISClient

logger = structlog.get_logger()


class BaseWorkflow(ABC):
    """
    Abstract base class for conversation workflows.
    Each workflow handles a specific type of request.
    """
    
    def __init__(self, his_client: HISClient):
        """
        Initialize workflow with HIS client.
        
        Args:
            his_client: Authenticated HIS API client
        """
        self.his_client = his_client
        self.api_calls: List[Dict[str, Any]] = []
    
    @property
    @abstractmethod
    def supported_intents(self) -> List[Intent]:
        """List of intents this workflow handles."""
        pass
    
    @abstractmethod
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """
        Execute the workflow.
        
        Args:
            session_id: Session ID
            intent: The classified intent
            entities: Extracted entities
            context: Conversation context
            
        Returns:
            WorkflowResult with response and state
        """
        pass
    
    async def continue_workflow(
        self,
        session_id: str,
        new_entities: Dict[str, Any],
        all_entities: Dict[str, Any],
        context: Dict[str, Any],
        is_confirmation: bool = False,
        is_denial: bool = False
    ) -> WorkflowResult:
        """
        Continue an in-progress workflow with new information.
        
        Args:
            session_id: Session ID
            new_entities: Newly extracted entities
            all_entities: All collected entities
            context: Full conversation context
            is_confirmation: User confirmed
            is_denial: User denied
            
        Returns:
            WorkflowResult
        """
        # Default implementation - subclasses can override
        return await self.execute(
            session_id=session_id,
            intent=self.supported_intents[0],
            entities=all_entities,
            context=context
        )
    
    def _get_missing_required_fields(
        self,
        intent: Intent,
        entities: Dict[str, Any]
    ) -> List[str]:
        """
        Get list of required fields that are missing.
        
        Args:
            intent: The intent
            entities: Current entities
            
        Returns:
            List of missing field names
        """
        config = INTENT_CONFIGS.get(intent)
        if not config:
            return []
        
        missing = []
        for field in config.required_entities:
            if field not in entities or not entities[field]:
                missing.append(field)
        
        return missing
    
    def _get_next_prompt(
        self,
        intent: Intent,
        missing_fields: List[str]
    ) -> Optional[str]:
        """
        Get prompt for the next missing field.
        
        Args:
            intent: The intent
            missing_fields: List of missing fields
            
        Returns:
            Prompt string or None
        """
        if not missing_fields:
            return None
        
        config = INTENT_CONFIGS.get(intent)
        if not config:
            return f"Please provide {missing_fields[0]}."
        
        next_field = missing_fields[0]
        return config.follow_up_prompts.get(
            next_field,
            f"Please provide {next_field.replace('_', ' ')}."
        )
    
    def _record_api_call(
        self,
        method: str,
        endpoint: str,
        request: Dict[str, Any],
        response: Dict[str, Any],
        success: bool
    ):
        """Record an API call for audit."""
        self.api_calls.append({
            "method": method,
            "endpoint": endpoint,
            "request": request,
            "response": response,
            "success": success
        })
    
    def _validate_phone(self, phone: str) -> Optional[str]:
        """Validate and normalize phone number."""
        import re
        # Remove non-digits
        digits = re.sub(r'\D', '', phone)
        
        # Indian phone number: 10 digits, optionally with country code
        if len(digits) == 10:
            return digits
        elif len(digits) == 12 and digits.startswith('91'):
            return digits[2:]
        elif len(digits) == 11 and digits.startswith('0'):
            return digits[1:]
        
        return None
    
    def _format_date(self, date_str: str) -> Optional[str]:
        """Parse and format date to ISO format."""
        from datetime import datetime, timedelta
        
        date_str_lower = date_str.lower().strip()
        today = datetime.now().date()
        
        # Handle relative dates
        if date_str_lower == "today":
            return today.isoformat()
        elif date_str_lower == "tomorrow":
            return (today + timedelta(days=1)).isoformat()
        elif "next week" in date_str_lower:
            return (today + timedelta(days=7)).isoformat()
        
        # Try common date formats
        formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%d %b %Y",
            "%d %B %Y",
            "%B %d, %Y",
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return parsed.date().isoformat()
            except ValueError:
                continue
        
        return None
